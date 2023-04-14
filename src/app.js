import express from 'express';
import cors from 'cors';
import PORT from './constants/PORT.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';


dotenv.config();
const app = express();
app.listen( PORT, () => console.log( `Server is running on ${chalk.green( `http://localhost:${PORT}` )}` ) );
app
    .use( cors() )
    .use( express.json() );

const mongoClient = new  MongoClient( process.env.DATABASE_URL );
let db;
    
mongoClient.connect()
    .then( () => {
        db = mongoClient.db();
        console.log( chalk.blue( 'DB CONNECTION SUCCESSFULLY' ) );
    } )
    .catch( ( err ) => {
        console.log( err, chalk.red( 'DB CONNECTION FAILED' ) );
    } );

app.get( '/participants', async( req, res ) => {
    try{
        const participants = await db.collection( 'participants' ).find().toArray();
        res.send( participants );
    }catch( err ){
        res.send( err.message );
    }
} );

app.get( '/messages', async( req, res ) => {
    const USER = req.headers.user;
    const {limit} = req.query;
    const publicTypes = ['message', 'status'];
    try{
        const messages = await db.collection( 'messages' ).find().toArray();
        const filteredMessages = messages.filter( ( message ) => {
            if( USER === message.to || USER === message.from || message.to === 'Todos' || publicTypes.includes( message.type ) ){
                return message;
            }
        } );

        if( !limit ){
            return res.send( filteredMessages );
        }
        
        if( limit > 0 && !Number.isNaN( Number( limit ) ) ) {
            return res.send( filteredMessages.slice( -limit ) );
        }
    
        res.status( 422 ).send( 'Limit tem um valor inválido' );
    }catch( err ){
        res.send( err.message );
    }
} );

app.post( '/participants', async( req, res ) => {

    const {name} = req.body;
    if( !name ){
        res.status( 422 ).send( {message : 'Nome não pode ser vazio'} );
        return;
    }

    try{
        const participant = await db.collection( 'participants' ).findOne( {name} );
        if( participant ) return  res.status( 409 ).send( {message : 'Usuário já cadastrado'} );
    }catch( err ){
        return res.send( err );
    }

    try{
        await db.collection( 'participants' ).insertOne( {name, lastStatus : Date.now()} );
    }catch( err ){
        return res.send( 'Erro ao cadastrar' );
    }
    
    try{
        const statusMessage = { 
            from: name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format( 'HH:mm:ss' )
        };
        await db.collection( 'messages' ).insertOne( statusMessage );
        res.status( 201 ).send( {message : 'Novo usuário cadastrado'} );
        console.log( 'Novo usuário cadastrado' );
    }catch( err ){
        res.status( 500 ).send( 'Erro ao cadastrar' );
    }
} );

app.post( '/messages', async( req, res ) => {

    const messageTypes = ['message', 'private_message'];
    const from = req.headers.user;
    const {to, text, type} = req.body;
    if( !from || !text || !type || !to || !messageTypes.includes( type ) ){
        return res.status( 422 ).send( {message : 'Campo body/headers é inválido. Verifique todos os dados'} );
    }

    try{
        const user = await db.collection( 'participants' ).findOne( { name : from} );
        if( !user ){
            return res.status( 422 ).send( {message : 'Você não está logado'} );
        }
    }catch( err ){
        console.log( err );
        return res.sendStatus( 500 );
    }
    
    try{
        const message = {
            to,
            text,
            type,
            from,
            time : dayjs().format( 'HH:mm:ss' )
        };
        console.log( message );
        await db.collection( 'messages' ).insertOne( message );
        res.status( 201 ).send( {message : 'mensagem enviada'} );
    }catch( err ){
        console.log( err );
        return res.sendStatus( 500 );
    }
} );

app.post( '/status', async( req, res ) => {
    const name = req.headers.user;
    if( !name ){
        return res.status( 404 ).send( {message : 'Não foi possível manter o usuário logado'} );
    }

    try{
        const user = await db.collection( 'participants' ).findOne( {name} );
        if( !user ) return res.status( 404 ).send( {message : 'Usuário não encontrado'} );
    }catch( err ){
        return res.sendStatus( 500 );
    }
    
    try{
        await db.collection( 'participants' ).updateOne( {name}, {
            $set : {
                lastStatus : Date.now()
            }
        } );
        res.status( 200 ).send( {message : 'Usuário online'} );
    }catch( err ){
        res.sendStatus( 500 );
    }
} );

// app.delete('/messages/:ID_DA_MENSAGEM', (req, res) => {
    
// });
const keepLogin = setInterval( () => {
    const maxUpdateTime = 10000;    
    db.collection( 'participants' ).find().toArray()
        .then( users => {
            users.forEach( ( {lastStatus, name} ) =>{
                if( Date.now() - lastStatus >= maxUpdateTime || !lastStatus ){
                    db.collection( 'participants' ).deleteOne( { name } )
                        .then( ()=> {
                            const exitMessage ={
                                from: name,
                                to: 'Todos', 
                                text: 'sai da sala...', 
                                type: 'status', 
                                time: dayjs().format( 'HH:mm:ss' )
                            };
                            db.collection( 'messages' ).insertOne( exitMessage )
                                .then( () => {
                                    console.log( chalk.red( `${name} foi removido pois estava offline` ) );
                                    return;
                                } )
                                .catch( ( err )=> {
                                    console.log( err );
                                    return;
                                } ); 
                        } );
                }
            } );
        } );
}, 15000 );

console.log( keepLogin );