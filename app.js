const express = require('express')

const app = express()
 
const bodyParser = require('body-parser')
const { spawn, exec } = require('child_process')
const { inspect } = require('util')

const fs = require('fs');
const path = require('path');

// A lookup table for geting the requied data to return
let sessionToReturnData = {}

function onError(data, stage, sessionid, id, res) {
	const dataString = data.toString()

	if (!sessionid) return res.status(400)

	if (!sessionToReturnData[sessionid]) return res.status(404)
	
	if (!id) id = Object.keys(sessionToReturnData[sessionid])[0]
	
	console.error(dataString)

	parseDownloadChunk(dataString, stage)
	
	try {
		res.json(sessionToReturnData[sessionid][id])
	}
	catch (e) {
		console.error(e)
		res.status(500)
	}
	
	killDownloads(sessionid, id)
}

function isObject(object) {
	if (object != null) return Object.keys(object).length != 0
	else return false
}

function killDownloads(sessionid, id) {
	console.warn(`Killing Downloads At ${sessionid} (${id})`)

	const killDir = (sessionid) ? `downloads/${sessionid}` : 'downloads'
	
	// Read an loop though all the files in the 'downloads' directory
	if (id) {
		// Update Return Data
		try {
			delete sessionToReturnData[sessionid][id]
		}
		catch(e) {
			console.error(e)
		}
			
		fs.readdir(killDir, (err, files) => {
			if (err) return console.error(err)
			
			for (const file of files) {
				if (file.includes(id)) {
					
					// Distroys Each file 
					fs.unlink(path.join(`downloads/${sessionid}`, file), err => {
						if (err) console.error(err);
					});
				}
			}
		});
	}
	else {
		// Update Return Data
		if (sessionid) delete sessionToReturnData[sessionid];
		else sessionToReturnData = {};
		
		fs.readdir(killDir, (err, files) => {
			if (err) return console.error(err);
			
			for (const file of files) {
	
				// Distroys Each file 
				fs.unlink(path.join(killDir, file), err => {
					if (err) console.error(err);
				});
			}
		});
	}
	
	updateDatabase()
}

function updateDatabase() {
	for (sessionid in sessionToReturnData) {
		if (Object.keys(sessionToReturnData[sessionid]).length == 0) delete sessionToReturnData[sessionid]
	}

	return fs.writeFileSync('database/sessionData.json', JSON.stringify(sessionToReturnData))
}

function updatesessionToReturnData() {
	const data = fs.readFileSync('database/sessionData.json', 'utf8')

	if (data) {
		sessionToReturnData = JSON.parse(data)
	}
	
	return sessionToReturnData
}

function parseDownloadChunk(chunk, stage) {
	const trimChunk = chunk.trim()
	
	const numbOfLines = trimChunk.split('\n').length
	const lastLineChunk = trimChunk.split('\n')[numbOfLines - 1]

	if (lastLineChunk.includes('[download]')) {
		
		const parts = lastLineChunk.split(' ')
		
		let percentString = (parts[2] === '') ? parts[3] : parts[2]
		
		// Check if it is 100 percent (accedently chose 'of' insted of the percent)
		if (percentString.includes('o')) percentString = '100.0'
		
		const percent = Number(percentString.slice(0, -1))
		const ETA = parts[parts.length - 1]
		
		return {type: 'download', percent, ETA, stage: 'cDownload'}
	}
	else if (lastLineChunk.includes('[ffmpeg]')) {
		return {type: 'ffmpeg', stage: 'ffmpeg'}
	}
	else if (lastLineChunk.includes('ERROR')) {
		const parts = lastLineChunk.trim()
			.split(' ')
			.slice(0, 1)
		
		const error = parts.join(' ')
		
		return {type: 'error', error, stage}
	}
	else {
		return {stage}
	}
}

function youtube_parser(url){
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

// IDK
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(express.static('public'))

// Uses the EJS templeting engine
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('index')
})

app.post('/getinfo', (req, res) => {
	const sessionid = req.body.sessionid
	const url = req.body.url	
	const id = youtube_parser(url)
	const ext = (req.body.ext) ? req.body.ext : 'mp3' 

	console.log(`Downloading video from ${req.body.url} by ${sessionid}`)

	const youtubeProsses = spawn('youtube-dl', [`--rm-cache-dir`, `--extract-audio`, `--audio-format`, ext, `--output`, `downloads/${sessionid}/${id}.${ext}`, `${req.body.url}`])
	
	youtubeProsses.stdout.on('data', data => {
		const chunkData = parseDownloadChunk(data.toString(), 'convert')

		console.log(chunkData, sessionid)
		
		if (chunkData) {
			if (sessionToReturnData[sessionid] == null) sessionToReturnData[sessionid] = {}
			
			switch (chunkData.type) {
				case 'download':
					const returnData = chunkData
					
					sessionToReturnData[sessionid][id] = returnData
					
					break;
			}
		}

		updateDatabase()
		
	})
	youtubeProsses.stderr.on('data', errorData => onError(errorData, 'convert', sessionid, id, res))
	//youtubeProsses.error.on('data', onError)
})

app.get('/getinfo', (req, res) => {	
	updatesessionToReturnData()

	if (!isObject(sessionToReturnData)) {		
		updateDatabase()
		return res.status(400)
	}
	
	const sessionid = req.query.sessionid
	const ext = (req.query.ext) ? req.query.ext : 'mp3' 
	const download = (req.query.download == 'true') ? true : false
	let id = req.query.id

	if (!sessionid) return res.status(400)

	if (!sessionToReturnData[sessionid]) return res.status(404)

	// Update the return stage

	if (id) {
		sessionToReturnData[sessionid][id].stage = 'compress'
		updateDatabase()
	}
	else id = Object.keys(sessionToReturnData[sessionid])
		
	// return the some data for the client to intepret
	if (!download) return res.json(sessionToReturnData[sessionid][id])
	
	exec(`zip downloads/${sessionid}/${id}.zip downloads/${sessionid}/${id}.${ext}`, err => {
		if (err) return onError(err, 'compress', sessionid, id, res)
		else {
			console.log('Downloading Files', sessionid)

			const base64Download = fs.readFileSync(`downloads/${sessionid}/${id}.zip`, {encoding: 'base64'});
			//console.log(base64Download) // BAD IDEA!!!
			
			res.json({file: base64Download, stage: null}) 

			killDownloads(sessionid, id)
		}
	})
	
})

app.listen(3000, () => {
    console.log('App is listening on port 3000')
})