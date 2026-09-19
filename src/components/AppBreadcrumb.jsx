import React from 'react'
import { Link, useLocation } from 'react-router-dom'

import { routes } from '../routes'

import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'

const matchRouteName = (pathname) => {
  for (const route of routes) {
    if (route.path === pathname) return route.name
    if (route.path.includes(':')) {
      const pattern = new RegExp(`^${route.path.replace(/:[^/]+/g, '[^/]+')}$`)
      if (pattern.test(pathname)) return route.name
    }
  }
  return null
}

const AppBreadcrumb = () => {
  const currentLocation = useLocation().pathname

  const getBreadcrumbs = (location) => {
    const breadcrumbs = []
    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`
      const routeName = matchRouteName(currentPathname)
      if (routeName) {
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length,
        })
      }
      return currentPathname
    })
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(currentLocation)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem as={Link} to="/">
        Home
      </CBreadcrumbItem>
      {breadcrumbs.map((breadcrumb) => (
        <CBreadcrumbItem
          as={breadcrumb.active ? undefined : Link}
          to={breadcrumb.active ? undefined : breadcrumb.pathname}
          {...(breadcrumb.active ? { active: true } : {})}
          key={breadcrumb.pathname}
        >
          {breadcrumb.name}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
