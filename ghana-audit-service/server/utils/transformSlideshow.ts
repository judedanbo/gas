import type { HeroSlide } from '~/types'
import type { SupportedLocale } from './locale'

interface SlideshowNewsArticle {
  id: number
  slug: string
  thumbnail: string | null
  category: string | null
  publishedAt: Date | string
  translations: Record<string, { title: string; excerpt: string }>
}

interface SlideshowEvent {
  id: string
  slug: string
  title: string
  description: string
  startDate: string
  thumbnail?: string
}

interface SlideshowGalleryImage {
  id: string
  url: string
  alt: string
  caption?: string
  uploadedAt: string
}

interface SlideshowReport {
  id: number
  slug: string
  thumbnail: string | null
  category: string
  publishedAt: Date | string | null
  translations: Record<string, { title: string; summary: string | null }>
}

const DEFAULT_IMAGES: Record<string, string> = {
  news: '/images/hero/default-news.svg',
  event: '/images/hero/default-event.svg',
  report: '/images/hero/default-report.svg'
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…'
}

export function transformNewsToSlide(
  article: SlideshowNewsArticle,
  locale: SupportedLocale = 'en'
): HeroSlide {
  const translation = article.translations[locale] ||
    article.translations.en || { title: 'Untitled', excerpt: '' }

  return {
    id: `news-${article.id}`,
    type: 'news',
    image: article.thumbnail || DEFAULT_IMAGES.news,
    imageAlt: translation.title,
    title: translation.title,
    excerpt: truncate(translation.excerpt, 120),
    linkUrl: `/media/news/${article.slug}`,
    linkLabel: 'slideshow.readMore',
    categoryLabel: 'slideshow.news',
    publishedAt: formatDate(article.publishedAt)
  }
}

export function transformEventToSlide(event: SlideshowEvent): HeroSlide {
  return {
    id: `event-${event.id}`,
    type: 'event',
    image: event.thumbnail || DEFAULT_IMAGES.event,
    imageAlt: event.title,
    title: event.title,
    excerpt: truncate(event.description, 120),
    linkUrl: `/events/${event.slug}`,
    linkLabel: 'slideshow.viewEvent',
    categoryLabel: 'slideshow.event',
    publishedAt: event.startDate
  }
}

export function transformGalleryToSlide(image: SlideshowGalleryImage): HeroSlide {
  return {
    id: `gallery-${image.id}`,
    type: 'gallery',
    image: image.url,
    imageAlt: image.alt,
    title: image.caption || image.alt,
    excerpt: '',
    linkUrl: '/media/gallery',
    linkLabel: 'slideshow.viewGallery',
    categoryLabel: 'slideshow.gallery',
    publishedAt: image.uploadedAt
  }
}

export function transformReportToSlide(
  report: SlideshowReport,
  locale: SupportedLocale = 'en'
): HeroSlide {
  const translation = report.translations[locale] ||
    report.translations.en || { title: 'Untitled Report', summary: null }

  return {
    id: `report-${report.id}`,
    type: 'report',
    image: report.thumbnail || DEFAULT_IMAGES.report,
    imageAlt: translation.title,
    title: translation.title,
    excerpt: truncate(translation.summary || '', 120),
    linkUrl: `/reports/${report.slug}`,
    linkLabel: 'slideshow.viewReport',
    categoryLabel: 'slideshow.report',
    publishedAt: formatDate(report.publishedAt)
  }
}
