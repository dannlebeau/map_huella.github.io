// Inicializar mapa en Nacimiento con capa satelital de Esri World Imagery
const map = L.map('map').setView([-37.5026, -72.6786], 13);

const satelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
});

// Control de capas base
const baseMaps = {
  "Satelital": satelital,
  "OpenStreetMap": osm
};

// Capas adicionales
let capaBuffer500mts = L.geoJSON(null, {
  style: {
    color: "orange",
    weight: 2,
    fillOpacity: 0.2
  }
});

let capaLimitesFundos = L.geoJSON(null, {
  style: {
    color: "purple",
    weight: 2,
    fillOpacity: 0.2
  }
});

let capaViviendas = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const tieneDatos = feature.properties.tiene_agua && feature.properties.tipo_conexion;
    return L.circleMarker(latlng, {
      radius: 6,
      color: tieneDatos ? "green" : "red",
      fillColor: tieneDatos ? "green" : "red",
      fillOpacity: 1
    });
  },
  onEachFeature: (feature, layer) => {
    let editable = !(feature.properties.tiene_agua && feature.properties.tipo_conexion);

    layer.on('click', () => {
      if (!editable) {
        layer.bindPopup("Datos ya guardados").openPopup();
        return;
      }

      const container = document.createElement("div");
      const textoGuardado = feature.properties.texto_adicional || "";

      container.innerHTML = `
        <strong>¿Tiene agua?</strong><br/>
        <input type="radio" name="agua" value="sí" ${feature.properties.tiene_agua === 'sí' ? 'checked' : ''}> Sí<br/>
        <input type="radio" name="agua" value="no" ${feature.properties.tiene_agua === 'no' ? 'checked' : ''}> No<br/>
        <strong>Tipo de conexión:</strong><br/>
        <select id="conexion">
          <option value="Red pública" ${feature.properties.tipo_conexion === "Red pública" ? "selected" : ""}>Red pública</option>
          <option value="Pozo/Noria" ${feature.properties.tipo_conexion === "Pozo/Noria" ? "selected" : ""}>Pozo/Noria</option>
          <option value="Aljibe" ${feature.properties.tipo_conexion === "Aljibe" ? "selected" : ""}>Aljibe</option>
          <option value="Río/Vertiente/Lago" ${feature.properties.tipo_conexion === "Río/Vertiente/Lago" ? "selected" : ""}>Río/Vertiente/Lago</option>
        </select><br/><br/>
        <label for="texto">Beneficiario (max 100 caracteres):</label><br/>
        <textarea id="texto" maxlength="100" rows="3" cols="30">${textoGuardado}</textarea><br/><br/>
        <button id="enviar">Enviar</button>
      `;

      layer.bindPopup(container).openPopup();

      container.querySelector("#enviar").addEventListener("click", () => {
        const tieneAgua = container.querySelector('input[name="agua"]:checked')?.value;
        const tipoConexion = container.querySelector("#conexion").value;
        const textoAdicional = container.querySelector("#texto").value.trim();

        if (!tieneAgua) {
          alert("Debe seleccionar si tiene agua.");
          return;
        }

        feature.properties.tiene_agua = tieneAgua;
        feature.properties.tipo_conexion = tipoConexion;
        feature.properties.texto_adicional = textoAdicional;

        layer.setStyle({
          color: "green",
          fillColor: "green"
        });

        editable = false;
        layer.closePopup();

        console.log("Datos guardados en feature:", feature.properties);
      });
    });
  }
});

// Control de capas
const overlayMaps = {
  "Buffer 500 mts": capaBuffer500mts,
  "Límites de fundos": capaLimitesFundos,
  "Viviendas": capaViviendas
};

L.control.layers(baseMaps, overlayMaps).addTo(map);

// Leyenda
const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.style.backgroundColor = 'white';
  div.style.padding = '8px';
  div.style.borderRadius = '5px';
  div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
  div.innerHTML = `
    <h4>Leyenda</h4>
    <i style="background: red; width: 12px; height: 12px; display: inline-block; margin-right: 5px;"></i> Sin datos<br>
    <i style="background: green; width: 12px; height: 12px; display: inline-block; margin-right: 5px;"></i> Datos guardados<br>
    <i style="background: orange; width: 12px; height: 12px; display: inline-block; margin-right: 5px;"></i> Buffer 500 mts<br>
    <i style="background: purple; width: 12px; height: 12px; display: inline-block; margin-right: 5px;"></i> Límites de fundos
  `;
  return div;
};
leyenda.addTo(map);

// Cargar polígono de Nacimiento y demás capas relacionadas
let poligonoNacimiento = null;

fetch('data/areas_relacionamiento.geojson')
  .then(res => res.json())
  .then(data => {
    const nacFeatures = data.features.filter(f => f.properties.c_dsc_z_adm_pat === "NACIMIENTO");

    if (nacFeatures.length > 0) {
      const geometry = nacFeatures[0].geometry;
      if (geometry.type === "MultiPolygon") {
        const merged = turf.union(...nacFeatures.map(f => turf.polygon(f.geometry.coordinates)));
        poligonoNacimiento = merged;
      } else {
        poligonoNacimiento = nacFeatures[0];
      }

      const layer = L.geoJSON(poligonoNacimiento, {
        style: {
          color: "#3388ff",
          weight: 2,
          fillOpacity: 0.1
        }
      }).addTo(map);

      map.fitBounds(layer.getBounds());

      cargarViviendas();
      cargarBuffer();
      cargarLimitesFundos();
    }
  });

// Función para cargar viviendas
function cargarViviendas() {
  fetch('data/viviendas_rurales_influencia_buffer.geojson')
    .then(res => res.json())
    .then(data => {
      const viviendasFiltradas = {
        type: "FeatureCollection",
        features: data.features.filter(punto =>
          turf.booleanPointInPolygon(punto, poligonoNacimiento)
        )
      };
      capaViviendas.clearLayers();
      capaViviendas.addData(viviendasFiltradas);
      capaViviendas.addTo(map);
    });
}

// Función para cargar el buffer filtrado
function cargarBuffer() {
  fetch("data/buffer_500mts.geojson")
    .then(res => res.json())
    .then(data => {
      console.log("Total buffers:", data.features.length);

      capaBuffer500mts.clearLayers();

      if (!poligonoNacimiento || !poligonoNacimiento.geometry) {
        console.error("Polígono de Nacimiento no definido.");
        return;
      }

      const bufferFiltrado = data.features.filter(f =>
        turf.booleanIntersects(f, poligonoNacimiento)
      );

      capaBuffer500mts.addData({
        type: "FeatureCollection",
        features: bufferFiltrado
      });

      capaBuffer500mts.addTo(map);
    })
    .catch(err => console.error("Error cargando buffer:", err));
}

// Función para cargar límites de fundos
function cargarLimitesFundos() {
  fetch('data/limites_fundos_32718.geojson')
    .then(res => res.json())
    .then(data => {
      const limitesFiltrados = {
        type: "FeatureCollection",
        features: data.features.filter(feature =>
          turf.booleanIntersects(feature, poligonoNacimiento)
        )
      };
      capaLimitesFundos.clearLayers();
      capaLimitesFundos.addData(limitesFiltrados);
      capaLimitesFundos.addTo(map);
    });
}
