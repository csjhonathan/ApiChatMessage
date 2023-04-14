import Joi from 'joi';
import sanitize from 'sanitize-html';

const messageSchema = Joi.object( {
    text : Joi
        .string()
        .required()
        .custom( ( value, helpers ) => {
            const sanitizedMessage = sanitize( value, {
                allowedTags: [],
                allowedAttributes: {}
            } );
            return sanitizedMessage;
        } )
        .trim( true )
} );

export default messageSchema;