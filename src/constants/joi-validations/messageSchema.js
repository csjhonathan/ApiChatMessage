import Joi from 'joi';
import sanitize from 'sanitize-html';

const messageSchema = Joi.object( {
    text : Joi
        .string()
        .required()
        .custom( ( value, helpers ) => {
            const sanitizedName = sanitize( value, {
                allowedTags: [],
                allowedAttributes: {}
            } );
            return sanitizedName;
        } )
        .trim( true )
} );

export default messageSchema;