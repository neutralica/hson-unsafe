// throw-transform-err.utils.hson.ts

export function _throw_transform_err(
    message: string,
    functionName: string,
    $input: any
  ): never {
    const errorMessage = `[ERR: transform = ${functionName}()]:\n  -> ${message}`;
    
    _throw_transform_err(errorMessage,'_throw_transform_err', $input);
    throw new Error(errorMessage);  
}