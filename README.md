# marble - 360° image viewer

This image viewer will display 360° images, and is based on three.js

## Installation

You don't actually need to install anything, you can simply refer to (once the repository becomes public!):

```
https://cdn.rawgit.com/jsguy/marble/master/dist/marble-latest.min.js
```

Optionally, if you prefer to host the JS yourself, place the JS file `dist/marble-latest.min.js` on your server, you just need that one file.

## Usage

These examples will each show a 360 degree image at 100% width, 480px height, or if the script tag is inside a container with a height and/or width set, it will use that.

### Unobtrusively with a preview image

```html
<img src="pic-preview.jpg" data-previewimg="pic-preview.jpg" data-img="pic.jpg">
...
<script src="marble-latest.min.js"></script>
```

### With a script tag:

```html
<script src="marble-latest.min.js" data-img="pic.jpg"></script>
```

### Manually

```html
<span id='target'></span>
<script src="marble-latest.min.js"></script>
<script>
	marble.init(document.getElementById('target'), {
		img: 'pic.jpg'
	});
</script>
```

### As a slideshow

```html
<script src="../src/marble.js" data-img="pic1.jpg|pic2.jpg|pic3.jpg"></script>
```

Note: to specify that you want a slideshow, simply include multiple images separated by a vertical bar "|".

## Options

You can specify options using `data` attributes on the script tag, here is a list of options:

* **data-img** - URL to the 360° image you want to display
* **data-previewimg** - optional URL to a preview image, this will cause the player to lazy load the image when the user clicks
* **data-horizontal** - horizontal degrees offset to start displaying the image, eg: 180 means show the "back" of the image initially, default is 0
* **data-vertical** - vertical degrees offset to start displaying the image, eg: -20 means "look down by 20 degrees", default is 0
* **zoom** - amount to zoom in/out - positive is zoom in, negative is zoom out, default value is 0
* **zoommax** - maximum amount of zoom, beyond 50, the image starts to look quite blurry, default is 50
* **zoommin** - minimum amount of zoom, the user will see a spherical shape with your 360 image, when the value is below -110 or so, depending on the diemnsions of your image viewport, default is -250
* **animatezoom** - animates a zoom from zoommin to 0 on startup, default is false
* **data-width** - the width of the image in pixels, default is to use the container width, or the full width, if no width is set
* **data-height** - the height of the image in pixels, uses the container height, or 480px if no height is set on the container
* **data-spin** - how many degrees to turn per second, when spinning is enabled, default is 3, set to 0 to disable spinning
* **data-startspin** - start spinning when the photo loads
* **data-animate** - decelerate animation when the photo loads
* **data-allowfullscreen** - allow the user to go full-screen - only available if the browser supports fullscreen, default is true
* **data-allowuserinteraction** - do we allow the user to interact with the image, default is true
* **data-clicktotogglespin** - does clicking stop/start spinning, default is false
* **data-behave** - don't render if there is another image 360° animating/spinning, or the user is interacting with another 360° image on the same page: this provides the best UX when there are several images on the page at once, default is true
* **data-overlay** - overlay a pixel mask to darken the image slightly - the can help with the visual apperance of some images, and is useful for background images, default is false
* **data-menutimeout** - how long till the menu auto-hides after mouseover in ms, default is 3500
* **data-fps** - specify how many FPS to use, (1-60), default is 60, this might be useful to limit CPU/GPU usage if you have several spinning 360° images on the page at once
* **data-usedeviceorientation** - allow mobile devices to move the image using the accelerometer, default is false mainly due to some phones accelerometer implementation being faulty
* **data-slideshowdelay** - time to show each picture in milliseconds, default is 9000
* **data-slideshowindex** - what slide to start on (0-indexed), default is 0


## Examples

See the `examples` directory for some examples