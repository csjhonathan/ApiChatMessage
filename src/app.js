import express from 'express';
import cors from 'cors';
import PORT from './constants/PORT.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

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
        console.log(chalk.blue('DB CONNECTION ACCEPTED'));
    })
    .catch((err) => {
        console.log(err.message);
    });

app.get('/', (req, res) => {
    db.collection('users').find().toArray()
        .then(users => res.send(users))
        .catch(err => res.send(err.message));
});