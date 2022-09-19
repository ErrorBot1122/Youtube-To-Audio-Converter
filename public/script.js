//import * as JSCookie from '../node_modules/js-cookie/dist/js.cookie.min.mjs' // Import JS-JSCookie
//import {$, jquery} from '../node_modules/jquery/dist/jquery.min.js'

// conversts to 32bit integer
function stringToHashConversion(string) {
	var hash = 0;
	if (string.length == 0) return hash;
	for (let i = 0; i < string.length; i++) {
		const char = string.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}

function base64toBlob(b64Data, contentType='', sliceSize=512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, {type: contentType});
  return blob;
}

function downloadBlob(blob, name = 'file.txt') {
	// Convert your blob into a Blob URL (a special url that points to an object in the browser's memory)
	const blobUrl = URL.createObjectURL(blob);
	
	// Create a link element
	const link = document.createElement('a');
	
	// Set link's href to point to the Blob URL
	link.href = blobUrl;
	link.download = name;
	
	// Append link to the body
	document.body.appendChild(link);
	
	// Dispatch click event on the link
	// This is necessary as link.click() does not work on the latest firefox
	link.dispatchEvent(
		new MouseEvent('click', { 
			bubbles: true, 
			cancelable: true, 
			view: window 
		})
	);
	
	// Remove link from body
	document.body.removeChild(link);
}

function jqueryHide(elt, hide = true) {
	if (hide) {
		elt.addClass('d-none')
		elt.removeClass('d-block')
	}
	else {
		elt.addClass('d-block')
		elt.removeClass('d-none')
	}
	
	return elt
}

function onError(error, stage) {
	switch (stage) {
		case 'init':
			$('#download-btn').text('Error while Initializing, Please try Again')
					
			jqueryHide($('#download-bar'))
			jqueryHide($('#download-now-btn'))

			break;
		case 'compress':
			$('#download-btn').text('Error while Compressing, Please try Again')
					
			jqueryHide($('#download-bar'))
			jqueryHide($('#download-now-btn'))

			break;
		default:
			$('#download-btn').text('An Unknown Error Occurred, Please try Again')

			jqueryHide($('#download-bar'))
			jqueryHide($('#download-now-btn'))
			break;
	}
	
	$('#download-btn').removeClass('btn-primary')
	$('#download-btn').addClass('btn-warning');
}

$('document').ready(() => {	
	let sessionid = Cookies.get('sessionid')
	let isInvalid = true
	let loadPercent = 0
	let error;
	let stage;

	// Check if page is in iframe
	//if ( window.location !== window.parent.location ) alert('This page is best used in a new tab')

	if ( !sessionid ) {
		sessionid = stringToHashConversion(new Date().toDateString())
		
		Cookies.set('sessionid', sessionid)
	}

	$('#url-input').keyup(() => { // Using keyup as the 'input' event exsits in jquery
		const url = $('#url-input').val()
		const urlTest = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/

		if ( !urlTest.test(url) ) {
			$('#download-btn').prop('disabled', true);
			isInvalid = true
		}
		else {
			$('#download-btn').prop('disabled', false);
			isInvalid = false
		}
	})
	
	$('#url-form').submit(() => {
		stage = 'init'
		error = null

		$('#download-btn').addClass('btn-primary')
		$('#download-btn').removeClass('btn-warning');
		
		console.log('Submit')

		const formData = new FormData($('#url-form')[0])		
		formData.set('sessionid', sessionid);


		const formObject = {};
		formData.forEach((value, key) => formObject[key] = value);

		const formJSON = JSON.stringify(formObject)

		// Send the FormdData as JSON
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/getinfo');
		xhr.setRequestHeader('Content-Type', 'application/json')
		xhr.send(formJSON);

		return false
	})

	$('#download-now-btn').click(() => {
		console.log('Downloading')
		$.ajax({
			type: 'GET',
			url: `/getinfo?sessionid=${sessionid}&download=true`,
			contentType: 'application/json',
			success: download => {
				const zipBlob = base64toBlob(download.file, 'application/zip')
				
				downloadBlob(zipBlob, 'video.zip')
				  
				console.log('Succsefully downloaded', JSON.stringify({download}))
			},
			error: console.error
		})
		
		//loadPercent = 0
	})
	
	setInterval(() => {
		$.ajax({
			type: 'GET',
			url: `/getinfo?sessionid=${sessionid}`,
			contentType: 'application/json',
			success: data => {
				stage = data.stage

				switch (data.type) {					
					case 'download':
						loadPercent = data.percent
						error = null
						break;
					case 'error':
						error = data.error
						loadPercent = 0
						stage = null;
						break;
				}
			},
			error: console.error
		})
		
		/*
		if (!loadPercent || loadPercent <= 0) {
			
			jqueryHide($('#download-btn'), false)
			
			if (!isInvalid) $('#download-btn').prop('disabled', false);

			jqueryHide($('#download-bar'))
			jqueryHide($('#download-now-btn'))

		}
		else if (loadPercent >= 100) {

			jqueryHide($('#download-now-btn'), false)

			if (loadPercent > 0 || !isInvalid) $('#download-btn').prop('disabled', false);
			
			jqueryHide($('#download-btn'))
			jqueryHide($('#download-bar'))
		}
		else {					
			
			
		}
		*/
		
		if (loadPercent >= 100) {
			$('#download-btn').text('Download Now')
		}
		else {
			$('#download-btn').text('Start Converting...')
		}

		switch (stage) {
			case 'init':
				$('#download-btn').text('Initializing, Please Wait...');
				break;
			case 'compress':
				$('#download-btn').text('Zipping...')
				break;	
			case 'convert':
				$('#download-btn').text('Converting...')
				break
			case 'cDownload':
				if (!loadPercent || loadPercent <= 0) {
			
					jqueryHide($('#download-btn'), false)
					
					if (!isInvalid) $('#download-btn').prop('disabled', false);
		
					jqueryHide($('#download-bar'))
					jqueryHide($('#download-now-btn'))
		
				}
				else if (loadPercent >= 100) {
		
					jqueryHide($('#download-now-btn'), false)
		
					if (loadPercent > 0 || !isInvalid) $('#download-btn').prop('disabled', false);
					
					jqueryHide($('#download-btn'))
					jqueryHide($('#download-bar'))
				}
				break;
		} 
		if (error) return onError(error, stage)

		
		
	}, 1000)
})