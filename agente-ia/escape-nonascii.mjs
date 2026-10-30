#!/usr/bin/env node
/**
 * Escapa todo caractere nao-ASCII (codepoint > 127) para a sequencia \uXXXX
 * nos arquivos .js indicados. Regra do projeto: em dist/js/*.js os acentos
 * precisam estar escapados, pois UTF-8 cru vira mojibake quando o SEI injeta
 * o script sem charset=utf-8.
 *
 * Uso:
 *   node agente-ia/escape-nonascii.mjs <arquivo.js> [outro.js ...]
 *   node agente-ia/escape-nonascii.mjs --check <arquivo.js>   (so reporta, nao grava)
 *
 * Caracteres no plano astral (>0xFFFF) viram par de surrogates \uXXXX\uXXXX,
 * que e exatamente como o JS representa no fonte. Idempotente.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const files = args.filter((a) => a !== '--check');

if (files.length === 0) {
    console.error('uso: node agente-ia/escape-nonascii.mjs [--check] <arquivo.js> ...');
    process.exit(2);
}

function escapeNonAscii(src) {
    let out = '';
    let count = 0;
    for (const ch of src) {
        const cp = ch.codePointAt(0);
        if (cp <= 0x7f) {
            out += ch;
        } else {
            count++;
            // ch pode ter 1 ou 2 unidades UTF-16; reusa a representacao nativa.
            for (let i = 0; i < ch.length; i++) {
                out += '\\u' + ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
            }
        }
    }
    return { out, count };
}

let anyFound = false;
for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const { out, count } = escapeNonAscii(src);
    if (count > 0) anyFound = true;
    if (checkOnly) {
        console.log(`${count > 0 ? 'NAO-ASCII' : 'OK       '} ${count}\t${file}`);
    } else if (count > 0) {
        writeFileSync(file, out, 'utf8');
        console.log(`escapados ${count} caractere(s) -> ${file}`);
    } else {
        console.log(`OK (0 nao-ASCII) -> ${file}`);
    }
}

if (checkOnly && anyFound) process.exit(1);
