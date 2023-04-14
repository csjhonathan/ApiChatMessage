import express from 'express';
import cors from 'cors';
import PORT from './constants/PORT.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import userSchema from './constants/joi-validations/userSchema.js';
import joiPlus from 'joi-plus';
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
        const participant = await db.collection( 'participants' ).findOne( {name : USER} );
        if( !participant ) return res.status( 422 ).send( {message : 'Você está offline'} );
    }catch( err ){
        res.sendStatus( 500 );
    }

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
    const validation = userSchema.validate( {name} );
    
    if( validation.error ){
        res.status( 422 ).send( {message : validation.error.details[0].message } );
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

app.put( '/messages/:ID_DA_MENSAGEM', async( req, res ) => {

    if( !req.headers.user ) return res.status( 422 ).send( {message : 'Campo headers inválido'} );

    const {ID_DA_MENSAGEM} =  req.params;
    const {to, text, type} = req.body;
    const VALIDY_TYPES = ['message', 'private_message'];
    const from = req.headers.user;
    
    if( !to || !text || !VALIDY_TYPES.includes( type ) ){
        return res.status( 422 ).send( {message : 'Campo body inválido'} );
    }   
    
    try{
        const participant = await db.collection( 'participants' ).findOne( {name : from} );
        if( !participant ) return res.status( 422 ).send( {message : 'Você está offline'} );

        const message = await db.collection( 'messages' ).findOne( {_id : new ObjectId( ID_DA_MENSAGEM )} );
        if( !message ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
        if( message.from !== from ) return res.status( 401 ).send( {message : 'Este usuário não é não pode editar esta mensagem!'} );

        const result = await db.collection( 'messages' ).updateOne(
            {_id : new ObjectId( ID_DA_MENSAGEM )},
            {$set : {to, text, type}}
        );

        if( !result.matchedCount ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
    }catch( err ){
        return res.status( 500 ).send( err );
    } 
    res.status( 204 ).send( {message : 'Mensagem atualizada'} );
} );

app.delete( '/messages/:ID_DA_MENSAGEM', async( req, res ) => {
    console.log( 'entrou' );
    if( !req.headers.user ) return res.status( 422 ).send( {message : 'Campo headers inválido'} );

    const {ID_DA_MENSAGEM} =  req.params;
    const from = req.headers.user;
    
    try{
        const participant = await db.collection( 'participants' ).findOne( {name : from} );
        if( !participant ) return res.status( 422 ).send( {message : 'Você está offline'} );

        const message = await db.collection( 'messages' ).findOne( {_id : new ObjectId( ID_DA_MENSAGEM )} );
        if( !message ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
        if( message.from !== from ) return res.status( 401 ).send( {message : 'Este usuário não é não pode editar esta mensagem!'} );

        const result = await db.collection( 'messages' ).deleteOne( {_id : new ObjectId( ID_DA_MENSAGEM )} );

        if( !result.deletedCount ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
    }catch( err ){
        return res.status( 500 ).send( err );
    } 
    res.status( 204 ).send( {message : 'Mensagem deletada com sucesso'} );
} );
const keepLogin = setInterval( async () => {
    const maxUpdateTime = 10000;  
    const users = {offline : null};

    try{
        users.offline =  await db.collection( 'participants' ).find( { lastStatus: { $lt: Date.now() - maxUpdateTime } } ).toArray(); 
    }catch( err ){
        console.log( err );
    }

    try{
        await db.collection( 'participants' ).find( { lastStatus: { $lt: Date.now() - maxUpdateTime } } ).toArray();
        if( !users.offline.length ) {
            return console.log( chalk.blue( 'No offline users' ) );
        }
        console.log( chalk.green( 'Offline users finded' ) );
    }catch( err ){
        console.log( err );
    }

    users.offline.forEach( async ( { name } ) =>{

        try{
            await db.collection( 'participants' ).deleteOne( { name } );
            console.log( chalk.red( `${name} foi removido pois estava offline` ) );
        }catch( err ){
            console.log( err );
        }
        
        try{
            const exitMessage ={
                from: name,
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time: dayjs().format( 'HH:mm:ss' )
            };
            await db.collection( 'messages' ).insertOne( exitMessage );
        }catch( err ){
            console.log( err );
        }
    }
    );
}, 15000 );