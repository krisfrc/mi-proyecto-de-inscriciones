UPDATE institucion_config
SET nombre = 'Escuela Básica Nacional La Cuadra de Bolívar',
    actualizado_en = CURRENT_TIMESTAMP
WHERE nombre IS DISTINCT FROM 'Escuela Básica Nacional La Cuadra de Bolívar';
