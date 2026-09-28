import { Fragment } from 'react'
import { linkify } from '../utils/linkify'

// Pinta texto plano convirtiendo las URLs en enlaces. No usa
// dangerouslySetInnerHTML: el texto se trocea en segmentos y se renderizan
// como nodos de React, asi que el contenido de la tarea nunca se interpreta
// como HTML.
const LinkifiedText = ({ text, className }) => {
  if (!text) return null

  const segments = linkify(text)

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.type === 'link' ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-auto"
          >
            {segment.value}
            <span className="visually-hidden"> (abre en una pestaña nueva)</span>
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        ),
      )}
    </span>
  )
}

export default LinkifiedText
