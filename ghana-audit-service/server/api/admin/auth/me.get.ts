export default defineEventHandler((event) => {
  const auth = event.context.auth

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Not authenticated'
    })
  }

  return {
    user: auth.user,
    session: auth.sessionTiming
  }
})
