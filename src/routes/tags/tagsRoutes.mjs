import express from 'express'
const tagsRouter = express.Router()
import tagsController from '../../controllers/tags/tagsController.mjs'

tagsRouter.post('/addTag', tagsController.addTags)
tagsRouter.get('/readAllTags', tagsController.readAllTags)
tagsRouter.get('/readTagID', tagsController.readTagID)

export default tagsRouter