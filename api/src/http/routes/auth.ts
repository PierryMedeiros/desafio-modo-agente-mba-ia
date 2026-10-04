import { Router } from 'express'
import { asyncHandler, HttpError } from '../errors'
import { currentUser, requireAuth, signToken } from '../middlewares/auth'
import { AuthService, loginSchema, registerSchema } from '../../services/auth-service'

export function authRoutes(authService: AuthService) {
  const router = Router()

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
      }
      const user = await authService.register(parsed.data)
      res.status(201).json(user)
    }),
  )

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
      }
      const user = await authService.login(parsed.data)
      res.json({ token: signToken(user), user })
    }),
  )

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(await authService.me(currentUser(req).id))
    }),
  )

  return router
}
