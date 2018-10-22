<?php
# Get square number
$squareNumber = null; // String like 00721
if (preg_match('|^[0-9]{5}$|', $_SERVER['QUERY_STRING'], $matches)) {
  $squareNumber = $matches[0];
}
if (empty($squareNumber)) {
  header("HTTP/1.0 404 Not Found");
  echo 'NOT FOUND';
  exit;
}

# Get JSON file
$path = './data/erc721/' . $squareNumber . '.json';

if (file_exists($path)) {
  $fileContents = file_get_contents($path);
  $jsonObject = json_decode($fileContents);
  echo json_encode($jsonObject);
  exit;
}

# If no file exists
$jsonObject = ['name'=>'Square #'.$squareNumber, 'description'=>'Available for sale', 'image'=>'https://tenthousandsu.com/erc721/'.$squareNumber.'.png'];
echo json_encode($jsonObject);
exit;
