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

// app.get('/participants', (req, res) => {
//     db.collection('participants').find().toArray()
//         .then(users => res.send(users))
//         .catch(err => res.send(err.message));
    
// });


// app.get('/messages', (req, res) => {
//     db.collection('messages').find().toArray()
//         .then(users => res.send(users))
//         .catch(err => res.send(err.message));
// });


app.post('/participants', (req, res) => {
    const {name} = req.body;
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
                            .then(()=> console.log('Status message inserted'))
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


// app.post('/messages', (req, res) => {
//     db.collection('messages').find().toArray()
//         .then(users => res.send(users))
//         .catch(err => res.send(err.message));
// });

// app.post('/status', (req, res) => {
//     db.collection('status').find().toArray()
//         .then(users => res.send(users))
//         .catch(err => res.send(err.message));
//     console.log(req.body);
// });