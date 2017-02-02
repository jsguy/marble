# Marble - 360° image viewer

This image viewer displays equirectangular 360° images, and is based on three.js

## Installation

You can install marble via bower:

```
bower install marble
```

Then reference the marble js file like so:

```html
<script src="bower_components/marble/dist/marble-latest.min.js"></script>
```

Or use the CDN file from here:

```
https://cdn.rawgit.com/jsguy/marble/master/dist/marble-latest.min.js
```

## Usage

These examples will each show a 360 degree image at 100% width, 480px height, or if the script tag is inside a container with a height and/or width set, it will use that.

### Unobtrusively with a preview image

```html
<img src="pic-preview.jpg" data-previewimg="pic-preview.jpg" data-img="pic.jpg">
...
<script src="marble-latest.min.js"></script>
```

### With a single script tag:

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

You can specify options using `data` attributes on the script tag, or passed into the init function, here is a list of options:

* **img** - URL to the 360° image(s) you want to display
* **imgcube** - Is this an image cube from 6 images, default is false, see the [Cube naming convention] below for how to name your images
* **imgcubekrmode** - When using a KRPano based image cube, we horizontally flip l,r,f,b, vertically flip d,u, default is false
* **imgcubeorder** - The order the images should be shown in the cube, default is "r,l,u,d,f,b", unless KR mode, in which case default is "r,l,u,d,b,f"
* **previewimg** - optional URL to a preview image, this will cause the player to lazy load the image when the user clicks
* **forceinit** - initialize even when a preview image is specified, useful for older browsers, default is false
* **horizontal** - horizontal degrees offset to start displaying the image, eg: 180 means show the "back" of the image initially, default is 0
* **vertical** - vertical degrees offset to start displaying the image, eg: -20 means "look down by 20 degrees", default is 0
* **zoom** - amount to zoom in/out - positive is zoom in, negative is zoom out, default value is 0
* **zoommax** - maximum amount of zoom, beyond 50, the image starts to look quite blurry, default is 50
* **zoommin** - minimum amount of zoom, the user will see a spherical shape with your 360 image, when the value is below -110 or so, depending on the diemnsions of your image viewport, default is -250
* **width** - the width of the image in pixels, default is to use the container width, or the full width, if no width is set
* **height** - the height of the image in pixels, uses the container height, or 480px if no height is set on the container
* **spin** - how many degrees to turn per second, when spinning is enabled, default is 3, set to 0 to disable spinning
* **startspin** - start spinning when the photo loads
* **animate** - decelerate animation when the photo loads
* **animatezoom** - animates a zoom from zoommin to 0 on startup, default is false
* **allowmousewheel** - do we allow the mouse wheel to zoom in/out, default is true
* **allowcrossorigin** - do we allow the image to be loaded from a different domain, (domain must support [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)), default is true
* **allowfullscreen** - allow the user to go full-screen - only available if the browser supports fullscreen, default is true
* **showsavepicbutton** - Do we show a button that allows the user to save an image from the current view, default is false
* **savepicpassthrough** - If the save pic button is shown, do we simply allow the use to subscribe to the "saveFile" event, rather than having the browser handle it, default is false
* **allowuserinteraction** - do we allow the user to interact with the image, default is true
* **clicktotogglespin** - does clicking stop/start spinning, default is false
* **behave** - don't render if there is another image 360° animating/spinning, or the user is interacting with another 360° image on the same page: this provides the best UX when there are several images on the page at once, default is true
* **overlay** - overlay a pixel mask to darken the image slightly - the can help with the visual apperance of some images, and is useful for background images, default is false
* **menutimeout** - how long till the menu auto-hides after mouseover in ms, default is 3500
* **fps** - specify how many FPS to use, (1-60), default is 60, this might be useful to limit CPU/GPU usage if you have several spinning 360° images on the page at once
* **usedeviceorientation** - allow mobile devices to move the image using the accelerometer, default is false mainly due to some phones accelerometer implementation being faulty
* **slideshowdelay** - time to show each picture in milliseconds, default is 9000
* **slideshowindex** - what slide to start on (0-indexed), default is 0

## Cube naming convention

The 6 images to be used in a cube must be named with an underscore, ("\_"), followed by one of the following letters at the end of the file name:

* **r** - right face of cube
* **l** - left face of cube
* **u** - up face of cube
* **d** - down face of cube
* **f** - front face of cube
* **b** - back face of cube

So for example you might name the images: cube_r.jpg, cube_l.jpg, etc...

Note: if your images do not follow this convention, we assume they are sorted in the imgcubeorder

## Examples

See the `examples` directory for some examples
