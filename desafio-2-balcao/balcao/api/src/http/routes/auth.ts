import { Router } from 'express'
import { asyncHandler, HttpError } from '../errors'
import { requireAuth, signToken } from '../middlewares/auth'
import { AuthService, EmailTakenError, InvalidCredentialsError, loginSchema, registerSchema, serializeUser } from '../../services/auth-service'
import { userRepository } from '../../repositories/user-repository'

const router = Router()
const authService = new AuthService(userRepository)

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
    }
    try {
      const user = await authService.register(parsed.data)
      res.status(201).json(user)
    } catch (err) {
      if (err instanceof EmailTakenError) throw new HttpError(409, 'email_taken', err.message)
      throw err
    }
  }),
)

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
    }
    try {
      const user = await authService.login(parsed.data)
      res.json({ token: signToken(user), user })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) throw new HttpError(401, 'invalid_credentials', err.message)
      throw err
    }
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id)
    if (!user) throw new HttpError(401, 'unauthorized', 'Usuário não encontrado')
    res.json(serializeUser(user))
  }),
)

export default router
