/**
 * useSchemaOrg - Composable for generating JSON-LD structured data
 */

export function useSchemaOrg() {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl || 'https://audit.gov.gh'

  /**
   * Government Organization schema
   */
  function getOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'GovernmentOrganization',
      '@id': `${siteUrl}/#organization`,
      name: 'Ghana Audit Service',
      alternateName: 'GAS',
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      description: 'The Ghana Audit Service has a constitutional mandate to audit all public accounts and report to Parliament, ensuring accountability in the use of public resources.',
      foundingDate: '1993',
      address: {
        '@type': 'PostalAddress',
        streetAddress: "Ministries Block 'O', 1 Old Race Course Drive",
        addressLocality: 'Accra',
        postalCode: 'M96',
        addressCountry: 'GH'
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+233-302-664929',
        contactType: 'customer service',
        email: 'info@audit.gov.gh',
        availableLanguage: ['en', 'ak']
      },
      sameAs: [
        'https://www.facebook.com/ghanaauditservice',
        'https://twitter.com/GhanaAudit'
      ]
    }
  }

  /**
   * WebSite schema
   */
  function getWebSiteSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Ghana Audit Service',
      description: 'Official website of the Ghana Audit Service - Protecting the Public Purse',
      publisher: {
        '@id': `${siteUrl}/#organization`
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      },
      inLanguage: ['en', 'ak']
    }
  }

  /**
   * NewsArticle schema
   */
  function getNewsArticleSchema(article: {
    title: string
    excerpt: string
    publishedAt: string
    author?: string
    thumbnail?: string
    slug: string
  }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.excerpt,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      author: {
        '@type': 'Organization',
        name: article.author || 'Ghana Audit Service',
        url: siteUrl
      },
      publisher: {
        '@id': `${siteUrl}/#organization`
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${siteUrl}/media/news/${article.slug}`
      },
      image: article.thumbnail || `${siteUrl}/og-image.png`
    }
  }

  /**
   * Report/Document schema
   */
  function getReportSchema(report: {
    title: string
    summary?: string
    publishedAt: string
    category: string
    fileUrl?: string
    id: string
  }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Report',
      name: report.title,
      description: report.summary || report.title,
      datePublished: report.publishedAt,
      author: {
        '@type': 'GovernmentOrganization',
        name: 'Ghana Audit Service'
      },
      publisher: {
        '@id': `${siteUrl}/#organization`
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${siteUrl}/reports/${report.id}`
      },
      about: {
        '@type': 'Thing',
        name: report.category
      },
      url: report.fileUrl || `${siteUrl}/reports/${report.id}`
    }
  }

  /**
   * BreadcrumbList schema
   */
  function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`
      }))
    }
  }

  return {
    getOrganizationSchema,
    getWebSiteSchema,
    getNewsArticleSchema,
    getReportSchema,
    getBreadcrumbSchema
  }
}
