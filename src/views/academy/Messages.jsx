import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CListGroup,
  CListGroupItem,
  CRow,
  CSpinner,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CAvatar,
  CBadge,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import {
  cilEnvelopeOpen,
  cilPaperPlane,
  cilPlus,
  cilSearch,
  cilUser,
  cilGroup,
  cilArrowLeft,
  cilX,
  cilTrash,
  cilArrowLeft as cilReply,
  cilPin,
  cilBell,
  cilChevronBottom,
} from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import useSupabaseMessaging from '../../hooks/useSupabaseMessaging'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import { formatDateTime } from '../../utils/format'

const Messages = () => {
  const { user, profile } = useAuth()
  const { students } = useSupabaseStudents()
  const {
    conversations,
    activeConversation,
    messages,
    loading,
    sending,
    fetchConversations,
    startConversation,
    sendMessage,
    setActiveConversation,
    loadMoreMessages,
    deleteMessage,
    subscribeToMessages,
  } = useSupabaseMessaging(user?.id)

  const [newConversationParticipant, setNewConversationParticipant] = useState('')
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [showDropdown, setShowDropdown] = useState(null)
  const messagesEndRef = useRef(null)
  const messageInputRef = useRef(null)
  const scrollableRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const studentOptions = students
    .filter((s) => s.id !== user?.id)
    .map((s) => ({ value: s.id, label: s.full_name }))

  useEffect(() => {
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeConversation])

  useEffect(() => {
    if (activeConversation?.conversation_id) {
      const unsubscribe = subscribeToMessages(activeConversation.conversation_id, (newMessage) => {
        if (newMessage.sender_id !== user?.id) {
          setMessages((prev) => [
            ...prev,
            {
              ...newMessage,
              sender_name: activeConversation.participant_name,
              is_own: false,
            },
          ])
          scrollToBottom()
        }
      })
      return unsubscribe
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, subscribeToMessages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!messageText.trim() || !activeConversation) return

    const content = replyToMessage
      ? `@${replyToMessage.sender_name}: ${replyToMessage.content}\n${messageText.trim()}`
      : messageText.trim()

    await sendMessage(activeConversation.conversation_id, content, {
      replyToId: replyToMessage?.id,
    })
    setMessageText('')
    setReplyToMessage(null)
    scrollToBottom()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleStartConversation = async () => {
    if (!newConversationParticipant) return
    const convId = await startConversation([newConversationParticipant])
    if (convId) {
      setShowNewConversationModal(false)
      setNewConversationParticipant('')
      // The conversation will appear in the list after refetch
    }
  }

  const formatDateTimeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'ahora'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
    return formatDateTime(dateString)
  }

  const getInitials = (name) => {
    return (
      name
        ?.split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase() || '?'
    )
  }

  const openDropdown = (messageId) => {
    setShowDropdown(messageId)
  }

  const closeDropdown = () => {
    setShowDropdown(null)
  }

  const handleReply = (message) => {
    setReplyToMessage(message)
    messageInputRef.current?.focus()
    closeDropdown()
  }

  const handleDelete = async (messageId) => {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    await deleteMessage(messageId)
    closeDropdown()
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold d-flex align-items-center gap-2">
                <CIcon icon={cilEnvelopeOpen} className="text-primary" />
                Mensajes
              </span>
              <CButton color="primary" size="sm" onClick={() => setShowNewConversationModal(true)}>
                <CIcon icon={cilPlus} className="me-1" />
                Nuevo mensaje
              </CButton>
            </CCardHeader>
            <CCardBody className="p-0">
              <div className="row g-0 h-100" style={{ minHeight: '600px' }}>
                {/* Conversation List */}
                <CCol
                  lg={4}
                  className="border-end d-flex flex-column"
                  style={{ minHeight: '600px' }}
                >
                  <CInputGroup className="p-3">
                    <CInputGroupText>
                      <CIcon icon={cilSearch} />
                    </CInputGroupText>
                    <CFormInput
                      type="text"
                      placeholder="Buscar conversaciones..."
                      // onChange could filter conversations
                    />
                  </CInputGroup>

                  <div
                    className="flex-grow-1 overflow-auto"
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                  >
                    <CListGroup flush>
                      {conversations.length > 0 ? (
                        conversations.map((conv) => (
                          <CListGroupItem
                            key={conv.conversation_id}
                            active={activeConversation?.conversation_id === conv.conversation_id}
                            onClick={() => setActiveConversation(conv)}
                            className="d-flex align-items-start gap-3 py-2 px-3 border-0 hover-bg"
                            style={{ cursor: 'pointer' }}
                          >
                            <CAvatar size="lg" color="primary" className="flex-shrink-0">
                              {getInitials(conv.participant_name)}
                            </CAvatar>
                            <div className="flex-grow-1 min-w-0">
                              <div className="d-flex justify-content-between">
                                <span className="fw-semibold text-truncate me-2">
                                  {conv.participant_name}
                                </span>
                                <small className="text-medium-emphasis flex-shrink-0">
                                  {conv.last_message_at
                                    ? formatDateTimeTime(conv.last_message_at)
                                    : ''}
                                </small>
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="text-truncate text-medium-emphasis small">
                                  {conv.last_message || 'Sin mensajes'}
                                </span>
                                {conv.unread_count > 0 && (
                                  <CBadge color="danger" className="ms-2 flex-shrink-0">
                                    {conv.unread_count}
                                  </CBadge>
                                )}
                              </div>
                            </div>
                          </CListGroupItem>
                        ))
                      ) : (
                        <CListGroupItem className="text-center text-medium-emphasis py-5">
                          <CIcon icon={cilEnvelopeOpen} size="lg" className="mb-2" />
                          <p className="mb-1">No hay conversaciones aún</p>
                          <small>Inicia una conversación con un compañero o profesor</small>
                        </CListGroupItem>
                      )}
                    </CListGroup>
                  </div>
                </CCol>

                {/* Chat Area */}
                <CCol lg={8} className="d-flex flex-column" style={{ minHeight: '600px' }}>
                  {activeConversation ? (
                    <>
                      <CCardHeader className="border-0 bg-transparent px-3 py-2">
                        <div className="d-flex align-items-center gap-3">
                          <CAvatar size="lg" color="primary">
                            {getInitials(activeConversation.participant_name)}
                          </CAvatar>
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold text-truncate">
                              {activeConversation.participant_name}
                            </div>
                            <small className="text-medium-emphasis">
                              {activeConversation.unread_count > 0
                                ? `${activeConversation.unread_count} no leídos`
                                : 'En línea'}
                            </small>
                          </div>
                          <CDropdown>
                            <CDropdownToggle color="secondary" variant="ghost" size="sm">
                              <CIcon icon={cilChevronDown} />
                            </CDropdownToggle>
                            <CDropdownMenu>
                              <CDropdownItem onClick={() => {}} disabled>
                                <CIcon icon={cilPin} className="me-2" /> Fijar
                              </CDropdownItem>
                              <CDropdownItem onClick={() => {}} disabled>
                                <CIcon icon={cilBell} className="me-2" /> Silenciar
                              </CDropdownItem>
                            </CDropdownMenu>
                          </CDropdown>
                        </div>
                      </CCardHeader>

                      <div
                        ref={scrollableRef}
                        className="flex-grow-1 overflow-auto"
                        style={{ maxHeight: 'calc(100vh - 300px)' }}
                      >
                        <div
                          className="p-3"
                          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                        >
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`d-flex ${message.is_own ? 'justify-content-end' : 'justify-content-start'}`}
                            >
                              <div
                                className={`message-bubble d-flex flex-column max-w-75 ${message.is_own ? 'bg-primary text-white' : 'bg-light'}`}
                                style={{
                                  borderRadius: '12px',
                                  padding: '10px 14px',
                                  position: 'relative',
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  openDropdown(message.id)
                                }}
                              >
                                {!message.is_own && (
                                  <small className="text-medium-emphasis mb-1 px-1">
                                    {message.sender_name}
                                  </small>
                                )}

                                {message.reply_to_content && (
                                  <div
                                    className="reply-preview mb-1 p-2 rounded"
                                    style={{
                                      backgroundColor: message.is_own
                                        ? 'rgba(255,255,255,0.2)'
                                        : 'rgba(0,0,0,0.05)',
                                      borderLeft: '3px solid',
                                      borderColor: message.is_own
                                        ? 'rgba(255,255,255,0.5)'
                                        : 'var(--cui-primary)',
                                    }}
                                  >
                                    <small className="fw-semibold">
                                      {message.reply_to_sender_name}
                                    </small>
                                    <div
                                      className="text-truncate small"
                                      style={{ maxWidth: '200px' }}
                                    >
                                      {message.reply_to_content}
                                    </div>
                                  </div>
                                )}

                                <div className="message-content whitespace-pre-wrap">
                                  {message.content}
                                </div>

                                <div className="d-flex justify-content-end align-items-center gap-2 mt-1">
                                  <small
                                    className={`text-medium-emphasis ${message.is_own ? 'text-white-50' : ''}`}
                                  >
                                    {formatDateTimeTime(message.created_at)}
                                  </small>
                                  <CButton
                                    color="transparent"
                                    variant="ghost"
                                    size="sm"
                                    className="p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openDropdown(message.id)
                                    }}
                                  >
                                    <CIcon icon={cilChevronDown} size="sm" />
                                  </CButton>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </div>

                      {/* Reply indicator */}
                      {replyToMessage && (
                        <div className="p-3 border-top bg-light d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilReply} className="text-primary" />
                            <small>
                              Respondiendo a <strong>{replyToMessage.sender_name}</strong>
                            </small>
                          </div>
                          <CButton
                            color="secondary"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyToMessage(null)}
                          >
                            <CIcon icon={cilX} size="sm" />
                          </CButton>
                        </div>
                      )}

                      {/* Message Input */}
                      <CCardBody className="p-3 border-top">
                        <form onSubmit={handleSendMessage}>
                          <CInputGroup>
                            <CFormInput
                              ref={messageInputRef}
                              type="text"
                              placeholder="Escribe un mensaje..."
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              onKeyDown={handleKeyDown}
                            />
                            <CButton
                              color="primary"
                              type="submit"
                              disabled={!messageText.trim() || sending}
                            >
                              <CIcon icon={cilPaperPlane} />
                            </CButton>
                          </CInputGroup>
                        </form>
                      </CCardBody>
                    </>
                  ) : (
                    <div className="flex-grow-1 d-flex align-items-center justify-content-center text-center">
                      <div className="p-4">
                        <CIcon
                          icon={cilEnvelopeOpen}
                          size="xl"
                          className="text-medium-emphasis mb-3"
                        />
                        <h5 className="text-medium-emphasis">Selecciona una conversación</h5>
                        <p className="text-medium-emphasis small">
                          O crea una nueva para empezar a chatear
                        </p>
                      </div>
                    </div>
                  )}
                </CCol>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* New Conversation Modal */}
      <CModal
        visible={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        backdrop="static"
      >
        <CModalHeader closeButton>
          <CModalTitle>Nuevo mensaje</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-medium-emphasis mb-3">Selecciona a quién quieres enviar un mensaje</p>
          <CFormSelect
            value={newConversationParticipant}
            onChange={(e) => setNewConversationParticipant(e.target.value)}
          >
            <option value="">Seleccionar destinatario...</option>
            {studentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setShowNewConversationModal(false)}
          >
            Cancelar
          </CButton>
          <CButton
            color="primary"
            onClick={handleStartConversation}
            disabled={!newConversationParticipant}
          >
            Iniciar conversación
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Message Dropdown */}
      {showDropdown && (
        <CDropdownMenu show position="bottom-end" onClose={closeDropdown}>
          <CDropdownItem onClick={() => handleReply(messages.find((m) => m.id === showDropdown))}>
            <CIcon icon={cilReply} className="me-2" /> Responder
          </CDropdownItem>
          {messages.find((m) => m.id === showDropdown)?.is_own && (
            <CDropdownItem color="danger" onClick={() => handleDelete(showDropdown)}>
              <CIcon icon={cilTrash} className="me-2" /> Eliminar
            </CDropdownItem>
          )}
        </CDropdownMenu>
      )}
    </>
  )
}

export default Messages
