import express from 'express';
import cors from 'cors';
import PORT from './constants/PORT.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import userSchema from './constants/joi-validations/userSchema.js';
import messageSchema from './constants/joi-validations/messageSchema.js';

dotenv.config();
const app = express();
app
    .use( cors() )
    .use( express.json() );

const mongoClient = new  MongoClient( process.env.DATABASE_URL );

try{
    await mongoClient.connect();
    console.log( chalk.blue( 'DB CONNECTION SUCCESSFULLY' ) );
    setInterval( deleteAfk, 15000 );
}catch( err ){
    console.log( err.message, chalk.red( 'DB CONNECTION FAILED' ) );
}

const db = mongoClient.db();

async function deleteAfk(){
    const maxUpdateTime = 10000;  

    try{
        const offline =  await db.collection( 'participants' ).find( { lastStatus: { $lt: Date.now() - maxUpdateTime } } ).toArray(); 

        if( !offline.length ) {
            return console.log( chalk.blue( 'No offline users' ) );
        }

        const exitMessages = offline.map( ( {name} ) => {
            return( {
                from: name,
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time: dayjs().format( 'HH:mm:ss' )
            } );
        } );

        await db.collection( 'participants' ).deleteMany( { lastStatus: { $lt: Date.now() - maxUpdateTime } } );
        await db.collection( 'messages' ).insertMany( exitMessages );
    }catch( err ){
        return console.log( chalk.red( `${err.message}` ) );
    }
}

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

    try{
        const participant = await db.collection( 'participants' ).findOne( {name : USER} );
        if( !participant ) return res.status( 422 ).send( {message : 'Você está offline'} );
    }catch( err ){
        res.sendStatus( 500 );
    }

    try{
        const filteredMessages = await db.collection( 'messages' ).find( { $or: [ { to : USER }  ,{ from : USER } , { to : 'Todos' }, { type : 'status' } , { type : 'message' } ] } ).toArray();

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
    const {error, value} = userSchema.validate ( {name : req.body.name} );
    const {name} = value;

    if( error || !name ){
        res.status( 422 ).send( {message : name ? error.details[0].message : 'Nome inválido' } );
        return;
    }
    

    try{
        const participant = await db.collection( 'participants' ).findOne( {name} );
        if( participant ) return  res.status( 409 ).send( {message : 'Usuário já cadastrado'} );
    }catch( err ){
        return res.send( err.message );
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

    if( !req.headers.user ) return res.status( 422 ).send( {message : 'Campo headers inválido'} );
    const {to, text, type} = req.body;

    const receiverValidation = userSchema.validate( {name: to} );
    const textValidationSanitize = messageSchema.validate( {text} );
    const textTrimed = messageSchema.validate( {text : textValidationSanitize.value.text} );
    

    const VALIDY_TYPE = ['message', 'private_message'].some( ty => ty=== type );
    const from = req.headers.user;
    const userValidation = userSchema.validate( {name : from} );

    if( receiverValidation.error || textTrimed.error || userValidation.error || !VALIDY_TYPE ){
        console.log( receiverValidation, textTrimed, userValidation );
        return res.status( 422 ).send( {message : 'Campo body inválido'} );
    }   

    try{
        const user = await db.collection( 'participants' ).findOne( { name : from} );
        if( !user ){
            return res.status( 422 ).send( {message : 'Você não está logado'} );
        }
    }catch( err ){
        console.log( err.message );
        return res.sendStatus( 500 );
    }
    
    try{
        const message = {
            to : receiverValidation.value.name,
            text : textTrimed.value.text,
            type,
            from,
            time : dayjs().format( 'HH:mm:ss' )
        };
        console.log( message );
        await db.collection( 'messages' ).insertOne( message );
        res.status( 201 ).send( {message : 'mensagem enviada'} );
    }catch( err ){
        console.log( err.message );
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

    const receiverValidation = userSchema.validate( {name: to} );
    const textValidation = messageSchema.validate( {text} );


    const VALIDY_TYPE = ['message', 'private_message'].some( ty => ty=== type );
    const from = req.headers.user;
    const userValidation = userSchema.validate( {name : from} );

    if( receiverValidation.error || textValidation.error || userValidation.error || !VALIDY_TYPE ){
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
        return res.status( 500 ).send( err.message );
    } 
    res.status( 200 ).send( {message : 'Mensagem atualizada'} );
} );

app.delete( '/messages/:ID_DA_MENSAGEM', async( req, res ) => {
    if( !req.headers.user ) return res.status( 422 ).send( {message : 'Campo headers inválido'} );

    const {ID_DA_MENSAGEM} =  req.params;
    const from = req.headers.user;
    
    try{
        const participant = await db.collection( 'participants' ).findOne( {name : from} );
        if( !participant ) return res.status( 422 ).send( {message : 'Você está offline'} );

        const message = await db.collection( 'messages' ).findOne( {_id : new ObjectId( ID_DA_MENSAGEM )} );
        if( !message ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
        if( message.from !== from ) return res.status( 401 ).send( {message : 'Este usuário não pode editar esta mensagem!'} );

        const result = await db.collection( 'messages' ).deleteOne( {_id : new ObjectId( ID_DA_MENSAGEM )} );

        if( !result.deletedCount ) return res.status( 404 ).send( {message : 'Mensagem não encontrada'} );
    }catch( err ){
        return res.status( 500 ).send( err.message );
    } 
    res.status( 200 ).send( {message : 'Mensagem deletada com sucesso'} );
} );

app.listen( PORT, () => console.log( `Server is running on ${chalk.green( `http://localhost:${PORT}` )}` ) );