function assignNestedField(target, fieldName, value) {
    const tokens = tokenize(fieldName);
    if (tokens.length === 0) {
        return;
    }

    let current = target;

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];
        const isLast = index === tokens.length - 1;

        if (isLast) {
            current[token] = value;
            return;
        }

        if (current[token] === undefined) {
            current[token] = isArrayToken(nextToken) ? [] : {};
        }

        current = current[token];
    }
}

function tokenize(fieldName) {
    if (!fieldName) {
        return [];
    }

    const normalized = `${fieldName}`
        .replace(/\[(\w+)\]/g, '.$1')
        .replace(/^\./, '');

    return normalized.split('.').filter(Boolean).map(function(token) {
        return /^\d+$/.test(token) ? parseInt(token, 10) : token;
    });
}

function isArrayToken(token) {
    return Number.isInteger(token);
}

function readMultipartValue(rawFields, key, fallback) {
    if (rawFields[key] === undefined) {
        return fallback;
    }

    const value = rawFields[key];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return fallback;
        }

        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            return JSON.parse(trimmed);
        }

        return value;
    }

    return value;
}

module.exports = {
    assignNestedField,
    readMultipartValue,
};
