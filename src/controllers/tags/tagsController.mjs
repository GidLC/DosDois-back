import TagsModel from "../../models/tags/tagsModel.mjs"

const addTags = (req, res) => {
    try {
        const {auth, nome} = req.body

        TagsModel.addTag(nome, auth, (err, results) => {
            if (err) {
                console.error(`Erro ao adicionar tag. ${err}`)
                return res.status(500).json({error: `Erro ao adicionar tag. ${err}`})
            }

            res.status(200).json({message: `Tag adicionada com sucesso`, results})
        })
    } catch (error) {
        throw error
    }
}

const readAllTags = (req, res) => {
    try {
        const auth = req.header('auth')

        TagsModel.readAllTags(auth, (err, results) => {
            if (err) {
                console.error(`Não foi possível buscar as tags. ${err}`)
                return res.status(500).json({error: `Não foi possível buscar as tags. ${err}`})
            }

            return res.status(200).json({message: 'Tags encontradas com sucesso', results})
        })
    } catch (error) {
        throw error
    }
}

const readTagID = (req, res) => {
    try {
        const auth = req.header('auth')
        const id = req.header('id')

        TagsModel.readTagID(id, auth, (err, results) => {
            if (err) {
                console.error(`Não foi possível buscar as informações dessa tag. ${err}`)
                res.status(500).json({error: `Não foi possível buscar as informações da tag. ${err}`})
            }

            res.status(200).json({message: "Tag encontrada com sucesso", results})
        })
    } catch (error) {
        throw error
    }
}

export default {addTags, readAllTags, readTagID}