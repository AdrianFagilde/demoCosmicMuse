import React from 'react'
import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'

import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

import { CBadge, CNavLink, CSidebarNav } from '@coreui/react'
import { getCurrentUser } from '../auth'

export const AppSidebarNav = ({ items }) => {
  const navLink = (name, icon, badge, indent = false) => {
    return (
      <>
        {icon
          ? icon
          : indent && (
              <span className="nav-icon">
                <span className="nav-icon-bullet"></span>
              </span>
            )}
        {name && name}
        {badge && (
          <CBadge color={badge.color} className="ms-auto" size="sm">
            {badge.text}
          </CBadge>
        )}
      </>
    )
  }

  const navItem = (item, index, indent = false) => {
    const { component, name, badge, icon, ...rest } = item
    const Component = component
    return (
      <Component as="div" key={index}>
        {rest.to || rest.href ? (
          <CNavLink
            {...(rest.to && { as: NavLink })}
            {...(rest.href && { target: '_blank', rel: 'noopener noreferrer' })}
            {...rest}
          >
            {navLink(name, icon, badge, indent)}
          </CNavLink>
        ) : (
          navLink(name, icon, badge, indent)
        )}
      </Component>
    )
  }

  const navGroup = (item, index) => {
    const { component, name, icon, items, to, ...rest } = item
    const Component = component
    return (
      <Component compact as="div" key={index} toggler={navLink(name, icon)} {...rest}>
        {items?.map((item, index) =>
          item.items ? navGroup(item, index) : navItem(item, index, true),
        )}
      </Component>
    )
  }

  const currentUser = getCurrentUser()

  const isAllowed = (item) => {
    if (!item.roles || item.roles.length === 0) {
      return true
    }
    return item.roles.includes(currentUser?.role)
  }

  const filterItems = (navItems) => {
    return navItems
      .map((item) => {
        if (item.items) {
          const filteredChildren = filterItems(item.items)
          if (filteredChildren.length === 0) {
            return null
          }
          return { ...item, items: filteredChildren }
        }
        return isAllowed(item) ? item : null
      })
      .filter(Boolean)
  }

  const visibleItems = filterItems(items)

  return (
    <CSidebarNav as={SimpleBar}>
      {visibleItems &&
        visibleItems.map((item, index) =>
          item.items ? navGroup(item, index) : navItem(item, index),
        )}
    </CSidebarNav>
  )
}

AppSidebarNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.any).isRequired,
}
