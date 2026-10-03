import React from 'react'
import { CTableDataCell, CTableRow } from '@coreui/react'

const Skeleton = ({ width, height, className = '', rounded = 'sm' }) => (
  <span
    className={`skeleton skeleton--${rounded} ${className}`.trim()}
    style={{ width, height }}
    aria-hidden="true"
  />
)

export const TableSkeletonRows = ({ rows = 5, columns = 4 }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <CTableRow key={rowIndex}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <CTableDataCell key={colIndex}>
            <Skeleton height="0.875rem" />
          </CTableDataCell>
        ))}
      </CTableRow>
    ))}
  </>
)

export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="skeleton-table" role="status" aria-label="Cargando">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div className="skeleton-table__row" key={rowIndex}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="skeleton-table__cell" height="0.875rem" />
        ))}
      </div>
    ))}
  </div>
)

export default Skeleton
