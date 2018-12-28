// 进行葵花光谱分析前的预处理，包括数据预处理与样本选择
// v1.0.0
// 刘鑫凯
// 2018.12.22

//**********  数据预处理  ***********


//  哨兵数据的去云函数 
function mask_clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}

// 对遥感数据进行时空范围确定以及去云处理 
var boundary = ee.FeatureCollection(states);
var sentinel_filtered = raw_sentinel
  .filterBounds(boundary)
  .filterDate('2016-01-01', '2016-04-01')
  .map(mask_clouds)
  .reduce(ee.Reducer.mode());

  
var rgbvis = {
  min: 0.0,
  max: 0.3,
  bands: ['B4_mode', 'B3_mode', 'B2_mode'],
};
  
Map.addLayer(sentinel_filtered, rgbvis, 'Sentinel-2');
  
print(sentinel_filtered);

  
//  通过置信波段选择作物（ 通过类似去云的方法来做）
var usda_filtered = usda
  .filterDate('2013', '2016')
  .map(function(image){
    
    var criterion = 85;
    var confidence = image.select('confidence');
    var mask = confidence.lt(criterion).eq(0);

    return image.updateMask(mask).select('cropland');
    
  });  

print(usda_filtered);

//  通过频率挑选合格作物（mode为众数）
var usda_reduced = usda_filtered
  .reduce(ee.Reducer.mode());

var crops = ee.Dictionary({
  corn : 1,
  rice : 3,
  soybean : 5,
  sunflower : 6,
  spring_wheat : 23,
  winter_wheat : 24,
  rapeseed: 34,
  sugarbeets: 41
}).toImage();

var crop_select = function(usda_reduced, crops){
  
  var mask_corn = usda_reduced.eq(crops.select('corn'));
  var mask_cotton = usda_reduced.eq(crops.select('cotton'));
  var mask_rice = usda_reduced.eq(crops.select('rice'));
  var mask_soybean = usda_reduced.eq(crops.select('soybean'));
  var mask_sunflower = usda_reduced.eq(crops.select('sunflower'));
  var mask_spring_wheat = usda_reduced.eq(crops.select('spring_wheat'));
  var mask_winter_wheat = usda_reduced.eq(crops.select('winter_wheat'));
  var mask_rapeseed = usda_reduced.eq(crops.select('rapeseed'));
  var mask_sugarbeets = usda_reduced.eq(crops.select('sugarbeets'));

  var temp = ee.Image(usda_reduced.updateMask(mask_corn).rename('corn'));
  
  return temp
  .addBands(usda_reduced.updateMask(mask_corn).rename('cotton'))
  .addBands(usda_reduced.updateMask(mask_rice).rename('rice'))
  .addBands(usda_reduced.updateMask(mask_soybean).rename('soybean'))
  .addBands(usda_reduced.updateMask(mask_sunflower).rename('sunflower'))
  .addBands(usda_reduced.updateMask(mask_spring_wheat).rename('spring_wheat'))
  .addBands(usda_reduced.updateMask(mask_winter_wheat).rename('winter_wheat'))
  .addBands(usda_reduced.updateMask(mask_rapeseed).rename('rapeseed'))
  .addBands(usda_reduced.updateMask(mask_sugarbeets).rename('sugarbeets'));
  
};  
  
var crop_selected = crop_select(usda_reduced, crops);

print(crop_selected);

/*
var visparam = {
  bands: ['cron', 'rice', 'soybean', 'sunflower',
  'spring_wheat', 'winter_wheat', 'rapeseed', 'sugarbeets'],
  min: 1,
  max: 41,
  palette: ' ffd300, 00a8e2, 257000,  fff00,' +
    ' d8b56b, a5700, d1ff00, a800e2'
};
*/

    
//Map.addLayer( usad_reduced, {}, 'crop_distribution');    
Map.addLayer( crop_selected, {bands: 'corn', palette: 'ffd300'}, 'corn');
Map.addLayer( crop_selected, {bands: 'cotton', palette: 'ff2626'}, 'cotton');
Map.addLayer( crop_selected, {bands: 'rice', palette: '00a8e2'}, 'rice');
Map.addLayer( crop_selected, {bands: 'soybean', palette: '257000'}, 'soybean');
Map.addLayer( crop_selected, {bands: 'sunflower', palette: 'ffff00'}, 'sunflower');
Map.addLayer( crop_selected, {bands: 'spring_wheat', palette: 'd8b56b'}, 'spring_wheat');
Map.addLayer( crop_selected, {bands: 'winter_wheat', palette: 'a57000'}, 'winter_wheat');
Map.addLayer( crop_selected, {bands: 'rapeseed', palette: 'd1ff00'}, 'rapeseed');
Map.addLayer( crop_selected, {bands: 'sugarbeets', palette: 'a800e2'}, 'sugarbeets');

//**********  样本选择 UI 组件的构建 **********

//  样本选择操作面板 
// Create an inspector panel with a horizontal layout.
var inspector = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {position:'bottom-left'}
});

// Add the panel to the default map.
Map.add(inspector);

var painting = ui.Panel({style:{width:'400px'}}).add(ui.Label('点击地图影像'));// 创建panel以存放charts
ui.root.add(painting);//将画布加到地图上


// 作物选择组件 
function creat_select(select_panel, plot_panel, data){
  
  var list = ee.List([]);
  var point;
  var crops = {
    corn: 'corn',
    rice: 'rice',
    soybean: 'soybean',
    sunflower: 'sunflower',
    spring_wheat: 'sprint_wheat',
    winter_wheat: 'winter_wheat',
    rapeseed: 'rapeseed',
    sugarbeets: 'sugerbeets'
    
  };
  var draw_chart = function(list){
    
    plot_panel.clear(); //清空画布 

    // 绘制样本图 
    var temp_points = ee.FeatureCollection(list);
    print(temp_points);
    // Define customization options.
    var options = {
      title: 'Sample Selection From Sentinel-2',
      hAxis: {title: 'band'},
      vAxis: {title: 'Reflectance'},
      lineWidth: 1,
      pointSize: 4,
      series: {}
    };
              
    // Define a list of Landsat 8 wavelengths for X-axis labels.
    var wavelengths = ee.List(['B1_mode', 'B2_mode', 'B3_mode', 'B4_mode', 'B5_mode', 
    'B6_mode', 'B7_mode', 'B8_mode', 'B9_mode', 'B10_mode', 'B11_mode', 'B12_mode']);
              
    // Create the chart and set options.
    var temp_Chart = ui.Chart.image.regions(
      data.select(wavelengths), temp_points, ee.Reducer.mean(), 30)
      .setChartType('LineChart')
      .setOptions(options);
            
//    print(temp_Chart);中
    print(list);
    plot_panel.add(temp_Chart);
    
    
  };
  
  var select = ui.Select({
    items: Object.keys(crops),
    onChange: function(key){
      
      select_panel.style().set('shown', true);
      select_panel.clear();
      
      //Select 组件，执行样本选择过程的按钮，挑选某种作物的样本并绘制示意图  
      select_panel.add(ui.Button({
        label:'Select',
        onClick: function(){
          
          list = ee.List([]);
          Map.style().set('cursor', 'crosshair');
          Map.onClick(function(coords){
            point = ee.Feature(ee.Geometry.Point(coords.lon, coords.lat));
            list = list.add(point);
            draw_chart(list);
          });
//        print(list);
        
        }
      }));
      
      // Delete组件，选取的样本不合适从样本中删除
      select_panel.add(ui.Button({
        
        label:'Delete',
        onClick: function(){
          list = list.remove(point);
          draw_chart(list);
        }
        
      }));
      
      // Finish组件，一种作物的样本挑选完成后选择这个按钮，输出矢量点 
      select_panel.add(ui.Button({
        
        label:'Finish',
        onClick: function(){
          Map.style().set('cursor', 'hand');
          var export_points = ee.FeatureCollection(list);
          Export.table.toAsset({
            collection:export_points,
            description: 'exportToTableAssetExample',
            assetId: key
          });
          
//          panel.add(ui.Label(list));
//          print(list);
//          list = ee.List([]);
//          panel.add(ui.Label(list));
        }
        
      }));
      
       //关闭按钮,会杀掉整个进程  
      select_panel.add(ui.Button({
        label:'Close',
        onClick:function(){
          Map.style().set('cursor', 'hand');
          panel.style().set('shown', false);
          Map.unlisten();
//          list = list.removeAll(list);
        }
      }));
      
    }
  });
  
  return select;
  
}

var select_item = creat_select(inspector, painting, sentinel_filtered);
print(select_item);


