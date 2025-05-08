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

const editTag = (req, res) => {
    try {
        const {auth, nome, id} = req.body

        TagsModel.editTag(id, auth, nome, (err, results) => {
            if(err) {
                console.error(`Não foi possível editar essa tag. ${err}`)
                res.status(500).json({error: `Não foi possível editar essa tag. ${err}`})
            }

            res.status(200).json({message: `Tag editada com sucesso`, results})
        })
    } catch (error) {
        throw error
    }
}

const deleteTag = (req, res) => {
    try {
        const casal = req.header('auth')
        const idTag = req.header('idTag')

        TagsModel.deleteTag(idTag, casal, (err, results) => {
            if (err) {
                console.error(`Não foi possível excluir essa tag. ${err}`)
                res.status(500).json({error: `Não foi possível excluir essa tag. ${err}`})
            }

            res.status(200).json({message: `Tag excluida com sucesso`, results})
        })
    } catch (error) {
        throw error
    }
}

const readTagsByTermo = (req, res) => {
    try {
        const termo = req.header('termo')
        const casal = req.header('auth')

        TagsModel.readTagsByTermo(termo, casal, (err, results) => {
            if (err) {
                console.error(`Não foi possível buscar as tags cadastradas`)
                res.status(500).json({error: `Não foi possível buscar as tags cadastrada. ${err}`})
            }

            res.status(200).json({message: `OK`, results})
        })
    } catch (error) {
        console.log(`Não foi possível buscar as tags. ${error}`)
    }
}

export default {addTags, readAllTags, readTagID, editTag, deleteTag, readTagsByTermo}