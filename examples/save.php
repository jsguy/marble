<?php
$fn = './imgs/'. str_replace(".", "-", uniqid("img", true)) . ".jpg";
file_put_contents($fn, base64_decode($_REQUEST['data']));
print($fn);
?>