const sharp = require('sharp')
const getWidthHeight = require('./getWidthHeight')
const fileTypeStream = require('file-type-stream').default
const { PassThrough } = require('stream')
const toArray = require('stream-to-array')
const debug = require('debug')('assets:returnImage')

const {
  SHARP_NO_CACHE
} = process.env

if (SHARP_NO_CACHE) {
  console.info('sharp cache disabled! (SHARP_NO_CACHE)')
  sharp.cache(false)
}

const pipeHeaders = [
  'Content-Type',
  'Last-Modified',
  'cache-control',
  'expires',
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Link',
  'Content-Disposition'
]

const supportedFormats = ['jpeg', 'png']

const toBuffer = async (stream) => {
  return toArray(stream)
    .then(parts => {
      const buffers = parts
        .map(part => Buffer.isBuffer(part) ? part : Buffer.from(part))
      return Buffer.concat(buffers)
    })
}

module.exports = async ({
  response: res,
  stream,
  headers,
  options = {}
}) => {
  const { resize, bw, webp, format, cacheTags = [] } = options
  let width, height
  if (resize) {
    try {
      ({ width, height } = getWidthHeight(resize))
    } catch (e) {
      res.status(400).end(e.message)
    }
  }

  // forward filtered headers
  if (headers) {
    for (let key of pipeHeaders) {
      const value = headers.get(key)
      if (value) {
        res.set(key, value)
      }
    }
  }

  // detect mime
  const passThrough = new PassThrough()
  try {
    let mime
    try {
      const fileTypeResult = await new Promise((resolve, reject) => {
        stream
          .pipe(fileTypeStream(resolve))
          .pipe(passThrough)
          .on('finish', reject.bind(null, 'Could not read enough of file to get mimetype'))
      })
      mime = fileTypeResult && fileTypeResult.mime
    } catch (e2) {
      debug('detecting mime failed: ', e2)
    }
    const isJPEG = mime === 'image/jpeg'

    // requests to github always return Content-Type: text/plain, let's fix that
    if (mime) {
      res.set('Content-Type', mime)
    }
    res.set('Cache-Tag',
      cacheTags
        .concat(mime && mime.split('/'))
        .filter(Boolean)
        .join(' ')
    )

    const forceFormat = supportedFormats.indexOf(format) !== -1

    let pipeline
    if (
      (mime && mime.indexOf('image') === 0 && (mime !== 'image/gif' || forceFormat)) &&
      (width || height || bw || webp || isJPEG || forceFormat)
    ) {
      pipeline = sharp()

      if (width || height) {
        pipeline.resize(width, height)
      }
      if (bw) {
        pipeline.greyscale()
      }
      if (forceFormat) {
        res.set('Content-Type', `image/${format}`)
        pipeline.toFormat(format, {
          // avoid interlaced pngs
          // - not supported in pdfkit
          progressive: format === 'jpeg',
          quality: 80
        })
      } else if (webp) {
        res.set('Content-Type', 'image/webp')
        pipeline.toFormat('webp', {
          quality: 80
        })
      } else if (isJPEG) {
        pipeline.jpeg({
          progressive: true,
          quality: 80
        })
      }
    }

    if (!pipeline && headers && headers.get('Content-Length')) { // shortcut
      res.set('Content-Length', headers.get('Content-Length'))
      passThrough.pipe(res)
    } else {
      // convert stream to buffer, because our cdn doesn't cache if content-length is missing
      res.end(
        pipeline
          ? await toBuffer(passThrough.pipe(pipeline))
          : await toBuffer(passThrough)
      )
      stream.destroy()
      passThrough.destroy()
    }
  } catch (e) {
    console.error(e)
    res.status(500).end()
    stream && stream.destroy()
    passThrough && passThrough.destroy()
  }
  debug('sharp stats: %o', sharp.cache())
}
