import nodemailer from 'nodemailer'

const adminMail = process.env.SMTP_USER
const adminPass = process.env.SMTP_PASS
const mailHost = process.env.SMTP_HOST ?? "smtp-mail.outlook.com"
const mailPort = Number(process.env.SMTP_PORT ?? 587)

class enviaEmailModel {
    static enviaEmail = async (destinatario, assunto, conteudo, callback) => {
        try {
            if (!adminMail || !adminPass) {
                return callback('SMTP não configurado', null)
            }

            const transpoter = nodemailer.createTransport({
                host: mailHost,
                port: mailPort,
                secure: false,
                auth: {
                    user: adminMail,
                    pass: adminPass
                }
            })
    
            const options = {
                from: adminMail,
                to: destinatario,
                subject: assunto,
                html: conteudo
            }

            await transpoter.sendMail(options)
    
            return callback(null, 'OK')
        } catch (error) {
            return callback(`Houve um erro no envio do e-mail, ${error}`, null)
        }
    }
}

export default enviaEmailModel
