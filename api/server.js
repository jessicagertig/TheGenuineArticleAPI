require('dotenv').config();

// ----- Imports ------
const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const helmet = require('helmet');

// ----- Router Imports -----
const authRouter = require('./auth/auth-router');
const itemsInfoRouter = require('./items-info/items-info-router');
const itemsImagesRouter = require('./items-images/items-images-router');
const itemsColorsRouter = require('./items-colors/items-colors-router');

// ----- Set up server ------
const server = express();

// ----- Middleware ------
server.use(helmet());
server.use(express.json());
server.use(cors());
server.use(logger('dev'));

// ------- Routers --------
server.use('/', authRouter);
server.use('/items', itemsInfoRouter);
server.use('/images', itemsImagesRouter);
server.use('/items_colors', itemsColorsRouter);

// ---- Testing If Server is Live ----
server.get('/', (req, res) => {
	res.status(200).json({ api: 'up', dbenv: process.env.NODE_ENV });
});

module.exports = server;
