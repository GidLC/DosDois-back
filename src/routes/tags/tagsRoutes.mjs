import express from 'express'
const tagsRouter = express.Router()
import tagsController from '../../controllers/tags/tagsController.mjs'
import { autenticarJWT } from '../../middlewares/auth.mjs';

tagsRouter.use(autenticarJWT)

tagsRouter.post('/addTag', tagsController.addTags)
tagsRouter.get('/readAllTags', tagsController.readAllTags)
tagsRouter.get('/readTagID', tagsController.readTagID)
tagsRouter.put('/editTag', tagsController.editTag)
tagsRouter.delete('/deleteTag', tagsController.deleteTag)
tagsRouter.get('/readTagsByTermo', tagsController.readTagsByTermo)

export default tagsRouter