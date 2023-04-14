import Joi from 'joi';
const userSchema = Joi.object( {
    name : Joi
        .string()
        .min( 3 )
        .max( 20 )
        .required()
        .pattern( new RegExp( '^[a-zA-Z0-9_\\-_@.áéíóúÁÉÍÓÚñÑ ]{3,30}$' ) )
} );

export default userSchema;