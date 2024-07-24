import folium
import pandas as pd
import geopandas as gpd
from shapely import wkt

# Load the data
merged = pd.read_csv('merged_data.csv')

# Convert the 'geometry' column to shapely geometries
merged['geometry'] = merged['geometry'].apply(wkt.loads)

# Convert DataFrame to GeoDataFrame
gdf = gpd.GeoDataFrame(merged, geometry='geometry')

# Ensure all geometries are present
gdf = gdf[gdf['geometry'].notnull()]

# Convert GeoDataFrame to GeoJSON
geo_json_data = gdf.to_json()

# Create the map
m = folium.Map(location=[37.8, -96], zoom_start=4)

# Add the choropleth layer
folium.Choropleth(
    geo_data=geo_json_data,
    data=gdf,
    columns=["GEOID", "6"],
    key_on='feature.properties.GEOID',
    fill_color='YlGnBu',
    fill_opacity=0.7,
    line_opacity=0.2,
).add_to(m)

# Save the map
m.save("map.html")