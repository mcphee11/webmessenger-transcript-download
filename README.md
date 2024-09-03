# webmessenger-transcript-download

This repo is an example of how you can enable the customer to download a copy of the WebMessenger transcript to a `PDF` on their client side. This adds a `download` button next to the default position of the launcher button. If you require to change the color or this button you can do this via the config, to change the location of it you will need to update the code.

![](/docs/images/download.png?raw=true)

Once you download the transcript you will get a PDF like the below screen shot:

![](/docs/images/pdf.png?raw=true)

This example uses [PDF-Lib](https://pdf-lib.js.org/) for the creation of the PDF file. For details on this package please reference its own documentation.

### types currently supported

Not ALL object types are supported yet fully the below items are supported as well as in what state:

- `Strings` or `Text`
- `Images` png or jpg/jpeg
- `Markdown` currently renders in "plain text"
- `emojis` currently don't render only show square placeholder

### updates planned

- move utc iso time to local
- render markdown better
- render emojis better
- allow more file types as icons only

If anyone whats to help with these new features I'm more then open to a PR for review, otherwise I will get to these if and when i can 😀

## Step 1 - Deploy code

To do this I would recommend using the tag manager that you used to deploy the default WebMessenger deployment code snippet. Download the [genesysTranscript.min.js](./genesysSurvey.min.js) and then host it somewhere, this can be with the rest of your website or a public AWS S3 or GCP Bucket for example. Once you have the URL add it to your website like the below.

You will also need to ensure you put the `configuration` items you want above the .min.js file to ensure the load before the fine runs. Ensure you update the `ENTER_YOUR_DEPLOYMENT_ID` with your own WebMessenger DeploymentId as well as the `region` to your own, as im in Australia its mypurecloud.com.au but your region will depend on the environment your using. The `gc_hexColor` is the color code of the new bubble button, the `gc_iconColor` can either be `white` or `black` and is the SVG icon on the button itself. If your using a lighter hex color I would suggest making the SVG black to ensure it can be seen correctly.

```
<script>
const gc_deploymentId = 'ENTER_YOUR_DEPLOYMENT_ID'
const gc_region = 'mypurecloud.com.au'
const gc_hexColor = '#000000'
const gc_iconColor = 'white'
</script>

<script src="https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"></script>
<script src="https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.js"></script>

<script src=./genesysTranscript.min.js></script>
```

Ensure that this is `BELOW` the default Genesys Cloud WebMessenger deployment snippet as the `Genesys` SDK that is used int his file needs to be loaded first. If you do run into load issues you can always add a `defer` to this so its forced to load later.

file that is in the repo, while you can use the .js version I have created a .min.js version to compress and mangle the code for prod deployment. I use [terser](https://terser.org/) to do this there are many other packages out there but if you do your own edits you can then use terser to create your own .min version of your own file if you did change the code. Or you can just use your raw .js version of the file.

### NOTE:

For PDF-Lib in the above snippet I have used the public `latest` version for the CDN, in a production install I recommend following there advice and selecting a specific version incase there are breaking changes in their package in the future. As per [here](https://pdf-lib.js.org/#umd-module)

![](/docs/images/pdf_lib_versions.png?raw=true)
