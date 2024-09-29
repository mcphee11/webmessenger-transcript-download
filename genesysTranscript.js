'use strict'

let gc_socket
let gc_token
let gc_icon

Genesys('subscribe', 'Launcher.ready', function () {
  if (JSON.parse(localStorage.getItem(`_${gc_deploymentId}:actmu`))) {
    gc_token = JSON.parse(localStorage.getItem(`_${gc_deploymentId}:actmu`)).value
    displayButton()
  } else {
    setTimeout(function () {
      gc_token = JSON.parse(localStorage.getItem(`_${gc_deploymentId}:actmu`)).value
      displayButton()
    }, 2000)
  }
})

function setupWSS() {
  //Create websocket for events
  try {
    gc_socket = new WebSocket(`wss://webmessaging.${gc_region}/v1?deploymentId=${gc_deploymentId}`)

    gc_socket.onmessage = async function (event) {
      let details = JSON.parse(event.data)
      console.log(details)

      // get jwt on session started
      if (details.class === 'SessionResponse') {
        let json = {
          action: 'getJwt',
          token: gc_token,
        }
        gc_socket.send(JSON.stringify(json))
      }

      // get jwt
      if (details.class === 'JwtResponse') {
        getHistory(details.body.jwt)
      }
    }
    console.log(`Waiting for events on wss://webmessaging.${gc_region}/v1?deploymentId=${gc_deploymentId}`)

    gc_socket.onopen = function () {
      let json = {
        action: 'configureSession',
        deploymentId: `${gc_deploymentId}`,
        token: gc_token,
      }
      gc_socket.send(JSON.stringify(json))
    }
  } catch (err) {
    console.error('Websocket error: ', err)
  }
}

async function getHistory(gc_jwt) {
  let request = await fetch(`https://api.${gc_region}/api/v2/webmessaging/messages`, {
    headers: {
      Authorization: `Bearer ${gc_jwt}`,
    },
  })
  let response = await request.json()
  console.log(response)
  createPdf(response)
}

async function createPdf(history) {
  const url = 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf'
  const fontBytes = await fetch(url).then((res) => res.arrayBuffer())

  const pdfDoc = await PDFLib.PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const ubuntuFont = await pdfDoc.embedFont(fontBytes)

  let page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const fontSize = 12
  let maxImageHeight = 150
  let yPosition = 3

  //loop through history array, reverse for public API
  if (history.total === 0) {
    console.warn('There are no messages currently')
    loadingOff()
    showError()
    return
  }

  for (const msg of history.entities.reverse()) {
    let image
    let imageScale = 1.0

    //check for image first
    if (msg?.content) {
      if (msg.content[0].contentType == 'Attachment') {
        if (msg.content[0].attachment.mediaType == 'Image' && msg.content[0].attachment.mime.includes('jpeg')) {
          const imageBytes = await fetch(msg.content[0].attachment.url).then((res) => res.arrayBuffer())
          image = await pdfDoc.embedJpg(imageBytes)
          if (image.height > maxImageHeight) {
            imageScale = maxImageHeight / image.height
          }
        }
        if (msg.content[0].attachment.mediaType == 'Image' && msg.content[0].attachment.mime.includes('png')) {
          const imageBytes = await fetch(msg.content[0].attachment.url).then((res) => res.arrayBuffer())
          image = await pdfDoc.embedPng(imageBytes)
          if (image.height > maxImageHeight) {
            imageScale = maxImageHeight / image.height
          }
        }
      }
    }

    if (msg.text) {
      // Check height incase new page is needed
      let newPage = newPageNeeded_rec_txt(page, ubuntuFont, msg.text, yPosition, width, height, fontSize)
      if (newPage.value) {
        page = pdfDoc.addPage()
        yPosition = 3
      }
      if (msg.direction == 'Outbound') {
        // Genesys
        const next = agentText(page, ubuntuFont, msg.text, yPosition, width, height, fontSize, msg.channel.time)
        yPosition = next
      }
      if (msg.direction == 'Inbound') {
        // Customer
        const next = customerText(page, ubuntuFont, msg.text, yPosition, width, height, fontSize, msg.channel.time)
        yPosition = next
      }
    }
    if (image) {
      let newPage = newPageNeeded_rec_img(page, yPosition, height, image.scale(imageScale).height, fontSize)
      if (newPage) {
        page = pdfDoc.addPage()
        yPosition = 3
      }
      if (msg.direction == 'Outbound') {
        // Genesys
        const next = agentImage(page, ubuntuFont, image, imageScale, yPosition, width, height, fontSize, msg.channel.time)
        yPosition = next
      }
      if (msg.direction == 'Inbound') {
        // Customer
        const next = customerImage(page, ubuntuFont, image, imageScale, yPosition, width, height, fontSize, msg.channel.time)
        yPosition = next
      }
    }
  }

  pdfDoc.setCreationDate(new Date())
  pdfDoc.setAuthor('https://github.com/mcphee11')
  pdfDoc.setSubject('Messaging transcript')
  const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })

  const downloadLink = document.createElement('a')
  downloadLink.href = pdfDataUri
  downloadLink.download = 'transcript.pdf'
  downloadLink.click()

  loadingOff()
}

function customerText(page, font, text, start, width, height, fontSize, time) {
  let second = start + 2
  let third = second + 1

  let newPage = newPageNeeded_rec_txt(page, font, text, start, width, height, fontSize)

  page.drawText('Customer', {
    x: 20,
    y: height - start * fontSize,
    size: fontSize,
    font: font,
  })

  let opts = {
    x: 20,
    y: height - second * fontSize,
    maxWidth: width - 40,
    wordBreaks: [' '],
    font: font,
    size: fontSize,
    lineHeight: fontSize,
  }

  page.drawRectangle({
    x: 10,
    y: height - third * fontSize - newPage.rec.height + fontSize,
    height: newPage.rec.height + 20,
    width: newPage.rec.width + 20,
    color: PDFLib.rgb(0, 0.8, 1),
  })
  page.drawText(text, opts)
  let forth = third + newPage.rec.lineCount

  page.drawText(new Date(time).toLocaleString(), {
    x: 20,
    y: height - forth * fontSize,
    size: 8,
    font: font,
  })

  let next = forth + 1

  return next
}

function customerImage(page, font, image, imageScale, start, width, height, fontSize, time) {
  let second = start + 2
  let third = second + 1

  page.drawText('Customer', {
    x: 20,
    y: height - start * fontSize,
    size: fontSize,
    font: font,
  })

  page.drawImage(image, {
    x: 20,
    y: height - third * fontSize - image.scale(imageScale).height,
    width: image.scale(imageScale).width,
    height: image.scale(imageScale).height,
  })
  let forth = third + image.scale(imageScale).height / fontSize + 1

  page.drawText(new Date(time).toLocaleString(), {
    x: 20,
    y: height - forth * fontSize,
    size: 8,
    font: font,
  })

  let next = forth + 1

  return next
}

function agentText(page, font, text, start, width, height, fontSize, time) {
  let second = start + 2
  let third = second + 1

  let newPage = newPageNeeded_rec_txt(page, font, text, start, width, height, fontSize)

  page.drawText('Genesys', {
    x: width - 70,
    y: height - start * fontSize,
    size: fontSize,
    font: font,
  })

  let opts = {
    x: width - newPage.rec.width - 20,
    y: height - second * fontSize,
    maxWidth: width - 40,
    wordBreaks: [' '],
    font: font,
    size: fontSize,
    lineHeight: fontSize,
  }

  page.drawRectangle({
    x: width - newPage.rec.width - 30,
    y: height - third * fontSize - newPage.rec.height + fontSize,
    height: newPage.rec.height + 20,
    width: newPage.rec.width + 20,
    color: PDFLib.rgb(0.8, 0.6, 0),
  })
  page.drawText(text, opts)
  let forth = third + newPage.rec.lineCount

  page.drawText(new Date(time).toLocaleString(), {
    x: width - 100,
    y: height - forth * fontSize,
    size: 8,
    font: font,
  })

  let next = forth + 1

  return next
}

function agentImage(page, font, image, imageScale, start, width, height, fontSize, time) {
  let second = start + 2
  let third = second + 1

  page.drawText('Genesys', {
    x: width - 70,
    y: height - start * fontSize,
    size: fontSize,
    font: font,
  })

  page.drawImage(image, {
    x: width - (image.scale(imageScale).width + 20),
    y: height - third * fontSize - image.scale(imageScale).height,
    width: image.scale(imageScale).width,
    height: image.scale(imageScale).height,
  })
  let forth = third + image.scale(imageScale).height / fontSize + 1

  page.drawText(new Date(time).toLocaleString(), {
    x: width - 100,
    y: height - forth * fontSize,
    size: 8,
    font: font,
  })

  let next = forth + 1

  return next
}

function newPageNeeded_rec_img(page, start, height, imageHeight, fontSize) {
  let second = start + 2
  let third = second + 1

  let value = false
  let bottom = height - third * fontSize - imageHeight + fontSize
  if (bottom < 5) {
    value = true
  }
  return value
}

function newPageNeeded_rec_txt(page, font, text, start, width, height, fontSize) {
  let second = start + 2
  let third = second + 1
  let value = false

  let build = {
    maxWidth: width - 40,
    wordBreaks: [' '],
    font: font,
    size: fontSize,
    lineHeight: fontSize,
  }

  let rec = drawMultilineText(page, text, build)
  let bottom = height - third * fontSize - rec.height + fontSize

  if (bottom < 5) {
    value = true
  }

  return { value, rec }
}

function drawMultilineText(page, text, opts) {
  const lines = PDFLib.breakTextIntoLines(text, opts.wordBreaks || page.doc.defaultWordBreaks, opts.maxWidth, (t) => opts.font.widthOfTextAtSize(t, opts.size))
  const lineCount = lines.length
  const height = lineCount * opts.lineHeight
  const width = Math.max(...lines.map((l) => opts.font.widthOfTextAtSize(l, opts.size)))
  return { width, height, lineCount }
}

const downLoadSvgBlack = `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/></g><g><path d="M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z"/></g></svg>`
const waitingLoadSvgBlack = `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/></g><g><path d="M18,22l-0.01-6L14,12l3.99-4.01L18,2H6v6l4,4l-4,3.99V22H18z M8,7.5V4h8v3.5l-4,4L8,7.5z"/></g></svg>`

const downLoadSvgWhite = `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><rect fill="none" height="24" width="24"/></g><g><path d="M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z"/></g></svg>`
const waitingLoadSvgWhite = `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><rect fill="none" height="24" width="24"/></g><g><path d="M18,22l-0.01-6L14,12l3.99-4.01L18,2H6v6l4,4l-4,3.99V22H18z M8,7.5V4h8v3.5l-4,4L8,7.5z"/></g></svg>`

function displayButton() {
  //Create Button
  let launcher = document.createElement('button')
  launcher.onclick = function () {
    loadingOn()
    setupWSS()
  }
  launcher.id = 'gc_downloadButton'
  launcher.style = `cursor: pointer;
      box-shadow: rgba(0, 0, 0, 0.2) 0px 3px 5px -2px, rgba(0, 0, 0, 0.14) 0px 1px 4px 2px, rgba(0, 0, 0, 0.12) 0px 1px 4px 1px;
      position: fixed !important;
      bottom: 24px !important;
      width: 56px;
      height: 56px;
      right: 96px !important;
      border-radius: 50%;
      background-color: ${gc_hexColor};
      z-index: 9999;
      border: 0px;`
  gc_iconColor == 'white' ? (launcher.innerHTML = downLoadSvgWhite) : (launcher.innerHTML = downLoadSvgBlack)
  document.body.appendChild(launcher)
}

function loadingOn() {
  let btn = document.getElementById('gc_downloadButton')
  gc_iconColor == 'white' ? (btn.innerHTML = waitingLoadSvgWhite) : (btn.innerHTML = waitingLoadSvgBlack)
}

function loadingOff() {
  let btn = document.getElementById('gc_downloadButton')
  gc_iconColor == 'white' ? (btn.innerHTML = downLoadSvgWhite) : (btn.innerHTML = downLoadSvgBlack)
}

function showError() {
  Genesys(
    'command',
    'Toaster.open',
    {
      title: 'Error',
      body: 'Sorry but there is no conversation currently to download. Please have a conversation first before trying to download the transcript.',
    },
    function () {},
    function (error) {
      console.log('There was an error running the Toaster.open command:', error)
    }
  )
}
