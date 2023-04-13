import express from 'express';
import cors from 'cors';
import PORT from './constants/PORT.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';


dotenv.config();
const app = express();
app.listen(PORT, () => console.log(`Server is running on ${chalk.green(`http://localhost:${PORT}`)}`));
app
    .use(cors())
    .use(express.json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
    
mongoClient.connect()
    .then(() => {
        db = mongoClient.db();
        console.log(chalk.blue('DB CONNECTION SUCCESSFULLY'));
    })
    .catch((err) => {
        console.log(err, chalk.red('DB CONNECTION FAILED'));
    });

app.get('/participants', (req, res) => {
    db.collection('participants').find().toArray()
        .then(users => res.send(users))
        .catch(err => res.send(err.message));
});


app.get('/messages', (req, res) => {
    const USER = req.headers.user;
    const {limit} = req.query;
    db.collection('messages').find().toArray()
        .then(messages =>{
            console.log(messages);
            const seenMessages = messages.filter((message) => {
                if(USER === message.to || USER === message.from || message.to === 'Todos'){
                    return message;
                }
            });

            if(!limit){
                return res.send(seenMessages);
            }
            if(limit > 0 && limit < messages.length) {
                return res.send( seenMessages.slice(-limit));
            }
            return res.status(422).send('Limit tem um valor inválido');
        })
        .catch(err => res.send(err.message));
});


app.post('/participants', (req, res) => {
    const {name} = req.body;
    // if(typeof name !== 'string'){
    //     return res.status(422).send({message : 'Nome deve conter APENAS letras e numeros'});
    // }
    if(!name){
        res.status(422).send({message : 'Nome não pode ser vazio'});
        return;
    }
    db.collection('participants').find({name}).toArray()
        .then(user => {
            if(!user.length){
                db.collection('participants').insertOne({name, lastStatus : Date.now()})
                    .then(() => {
                        const statusMessage = { 
                            from: name, 
                            to: 'Todos', 
                            text: 'entra na sala...', 
                            type: 'status', 
                            time: dayjs().format('HH:mm:ss')
                        };
                        db.collection('messages').insertOne(statusMessage)
                            .then(()=> console.log('Novo usuário cadastrado'))
                            .catch(err => console.log(err));
                        res.status(201).send({message : 'Novo usuário cadastrado'});
                    })
                    .catch(()=> res.send('Erro ao cadastrar'));
                return;
            }
            res.status(409).send({message : 'Usuário já cadastrado'});
        })
        .catch(err => res.send(err));
});


app.post('/messages', (req, res) => {

    const messageTypes = ['message', 'private_message'];
    const from = req.headers.user;
    const {to, text, type} = req.body;

    if(!from || !text || !type || !to || !messageTypes.includes(type)){
        return res.status(422).send({message : 'Campo body/headers é inválido. Verifique todos os dados'});
    }

    db.collection('participants').find({ name : from}).toArray()
        .then( user => {
            if(!user.length){
                return res.status(422).send({message : 'Você não está logado'});
            }
            const message = {
                to,
                text,
                type,
                from,
                time : dayjs().format('HH:mm:ss')
            };
            db.collection('messages').insertOne(message)
                .then(() => {
                    return res.status(201).send({message : 'mensagem enviada'});
                })
                .catch((err)=> {
                    console.log(err);
                    return res.sendStatus(500);
                });            
        })
        .catch((err)=> {
            console.log(err);
            return res.sendStatus(500);
        });   
    console.log(from, to, text, type);
    return;
    // db.collection('messages').find().toArray()
    //     .then(users => res.send(users))
    //     .catch(err => res.send(err.message));
});

// app.post('/status', (req, res) => {
//     db.collection('status').find().toArray()
//         .then(users => res.send(users))
//         .catch(err => res.send(err.message));
//     console.log(req.body);
// });