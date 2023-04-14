import Joi from 'joi';
import sanitize from 'sanitize-html';

const userSchema = Joi.object( {
    name : Joi
        .string()
        .custom( ( value, helpers ) => {
            const sanitizedName = sanitize( value, {
                allowedTags: [],
                allowedAttributes: {}
            } );
            return sanitizedName;
        } )
        .required()
        .trim( true )
} );

export default userSchema;