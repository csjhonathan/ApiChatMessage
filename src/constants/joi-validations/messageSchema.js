import Joi from 'joi';
const messageSchema = Joi.object( {
    text : Joi
        .string()
        .required()
} );

export default messageSchema;