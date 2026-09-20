import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseMessaging = (userId) => {
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: userId })
      if (error) throw error
      setConversations(data || [])
    } catch (err) {
      console.error('[Messaging] Fetch conversations error:', err)
    }
  }, [userId])

  const fetchMessages = useCallback(
    async (conversationId, before = null) => {
      if (!userId || !conversationId) return
      try {
        const { data, error } = await supabase.rpc('get_conversation_messages', {
          p_conversation_id: conversationId,
          p_user_id: userId,
          p_limit: 50,
          p_before: before,
        })
        if (error) throw error

        if (before) {
          setMessages((prev) => [...prev, ...(data || []).reverse()])
        } else {
          setMessages((data || []).reverse())
        }
      } catch (err) {
        console.error('[Messaging] Fetch messages error:', err)
      }
    },
    [userId],
  )

  useEffect(() => {
    if (userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchConversations()
    }
  }, [userId, fetchConversations])

  const startConversation = useCallback(
    async (participantIds) => {
      if (!userId) return null
      try {
        const { data, error } = await supabase.rpc('create_conversation', {
          p_created_by: userId,
          p_participant_ids: participantIds,
        })
        if (error) throw error
        await fetchConversations()
        return data
      } catch (err) {
        console.error('[Messaging] Create conversation error:', err)
        return null
      }
    },
    [userId, fetchConversations],
  )

  const sendMessage = useCallback(
    async (conversationId, content, options = {}) => {
      if (!userId) return null
      setSending(true)
      try {
        const { data, error } = await supabase.rpc('send_message', {
          p_conversation_id: conversationId,
          p_sender_id: userId,
          p_content: content,
          p_message_type: options.messageType || 'text',
          p_file_url: options.fileUrl || null,
          p_file_name: options.fileName || null,
          p_file_size: options.fileSize || null,
          p_reply_to_id: options.replyToId || null,
        })
        if (error) throw error

        // Update local state
        const newMessage = {
          id: data,
          sender_id: userId,
          content,
          message_type: options.messageType || 'text',
          file_url: options.fileUrl,
          file_name: options.fileName,
          reply_to_id: options.replyToId,
          created_at: new Date().toISOString(),
          is_own: true,
          sender_name: 'Tú',
        }
        setMessages((prev) => [...prev, newMessage])

        // Update conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.conversation_id === conversationId
              ? {
                  ...c,
                  last_message: content,
                  last_message_at: new Date().toISOString(),
                  unread_count: 0,
                }
              : c,
          ),
        )

        return data
      } catch (err) {
        console.error('[Messaging] Send message error:', err)
        return null
      } finally {
        setSending(false)
      }
    },
    [userId],
  )

  const markAsRead = useCallback(
    async (conversationId) => {
      if (!userId) return
      try {
        await supabase.rpc('mark_conversation_read', {
          p_conversation_id: conversationId,
          p_user_id: userId,
        })
        setConversations((prev) =>
          prev.map((c) => (c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c)),
        )
      } catch (err) {
        console.error('[Messaging] Mark read error:', err)
      }
    },
    [userId],
  )

  const setActive = useCallback(
    async (conversation) => {
      setActiveConversation(conversation)
      setMessages([])
      if (conversation) {
        await fetchMessages(conversation.conversation_id)
        await markAsRead(conversation.conversation_id)
      }
    },
    [fetchMessages, markAsRead],
  )

  const loadMoreMessages = useCallback(async () => {
    if (messages.length === 0 || !activeConversation) return
    const oldest = messages[0]
    await fetchMessages(activeConversation.conversation_id, oldest.created_at)
  }, [messages, activeConversation, fetchMessages])

  const deleteMessage = useCallback(
    async (messageId) => {
      if (!userId) return false
      try {
        const { error } = await supabase
          .from('messages')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', messageId)
          .eq('sender_id', userId)
        if (error) throw error
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        return true
      } catch (err) {
        console.error('[Messaging] Delete message error:', err)
        return false
      }
    },
    [userId],
  )

  const subscribeToMessages = useCallback((conversationId, callback) => {
    if (!conversationId) return () => {}

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    conversations,
    activeConversation,
    messages,
    loading,
    error,
    sending,
    fetchConversations,
    fetchMessages,
    startConversation,
    sendMessage,
    markAsRead,
    setActiveConversation: setActive,
    loadMoreMessages,
    deleteMessage,
    subscribeToMessages,
    refetch: fetchConversations,
  }
}

export default useSupabaseMessaging
