import type { AuditCategory, PublicationType } from '~/types'

type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'gray'

/**
 * Composable for consistent badge styling across audit categories and publication types
 */
export function useCategoryBadge() {
  // Audit category to badge variant mapping
  const auditCategoryVariants: Record<AuditCategory, BadgeVariant> = {
    'financial': 'primary',
    'performance': 'secondary',
    'compliance': 'accent',
    'it': 'info',
    'technical': 'gray',
    'follow-up': 'danger'
  }

  // Audit category labels
  const auditCategoryLabels: Record<AuditCategory, string> = {
    'financial': 'Financial Audit',
    'performance': 'Performance Audit',
    'compliance': 'Compliance Audit',
    'it': 'IT Audit',
    'technical': 'Technical Audit',
    'follow-up': 'Follow-up Review'
  }

  // Publication type to badge variant mapping
  const publicationTypeVariants: Record<PublicationType, BadgeVariant> = {
    'press-statement': 'primary',
    'bulletin': 'info',
    'guideline': 'accent',
    'manual': 'secondary',
    'strategy': 'success',
    'law': 'warning'
  }

  // Publication type labels
  const publicationTypeLabels: Record<PublicationType, string> = {
    'press-statement': 'Press Statement',
    'bulletin': 'Bulletin',
    'guideline': 'Guideline',
    'manual': 'Manual',
    'strategy': 'Strategy',
    'law': 'Law'
  }

  /**
   * Get badge variant for an audit category
   */
  function getAuditCategoryVariant(category: AuditCategory): BadgeVariant {
    return auditCategoryVariants[category] || 'gray'
  }

  /**
   * Get label for an audit category
   */
  function getAuditCategoryLabel(category: AuditCategory): string {
    return auditCategoryLabels[category] || category
  }

  /**
   * Get badge variant for a publication type
   */
  function getPublicationTypeVariant(type: PublicationType): BadgeVariant {
    return publicationTypeVariants[type] || 'gray'
  }

  /**
   * Get label for a publication type
   */
  function getPublicationTypeLabel(type: PublicationType): string {
    return publicationTypeLabels[type] || type
  }

  return {
    // Audit categories
    auditCategoryVariants,
    auditCategoryLabels,
    getAuditCategoryVariant,
    getAuditCategoryLabel,

    // Publication types
    publicationTypeVariants,
    publicationTypeLabels,
    getPublicationTypeVariant,
    getPublicationTypeLabel
  }
}
