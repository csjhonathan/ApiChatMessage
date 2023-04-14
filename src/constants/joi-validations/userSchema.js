import Joi from 'joi';

const userSchema = Joi.object( {
    name : Joi
        .string()
        .alphanum()
        .min( 3 )
        .max( 15 )
        .required()
} );

export default userSchema;