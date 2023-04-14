import Joi from 'joi-plus';
const userSchema = Joi.object( {
    name : Joi
        .string()
        .trim()
        .min( 3 )
        .max( 15 )
        .required()
        .pattern( new RegExp( '^[a-zA-Z0-9_\\-_@.áéíóúÁÉÍÓÚñÑ ]{3,30}$' ) )
} );

export default userSchema;