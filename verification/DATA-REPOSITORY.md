# Site data separation

Site content and publishing are independent of renderer configuration. The renderer
uses a 288-position interactive pool, a 160-position reference sequence, full
background geometry, and default refraction settings. Data separation does not
change rendering behavior.

## Boundary

- UI repository: application, models, fonts, Markdown builder, reader, and tests.
- Data input: Markdown, images, optional site.json, domain and favicon.
- RHINELAB_CONTENT_DIR selects the input; examples/rhine-lab is the default demo.
- Generated files stay in the UI checkout's .generated/ and dist/, never the input.
- Content directories may have different category counts and collection lengths.

## Checks

Run npm run check and npm run build, then build an external content directory
with RHINELAB_CONTENT_DIR. Tests cover content discovery, additions/moves/deletes,
links and assets, stable URLs, drafts, duplicate URLs, metadata, and navigation
with unequal collections on the unchanged 288-position pool. Motion, appearance,
and assembly checks continue to exercise the established visual behavior.

The default Rhine Lab example supplies 40 example records across five
collections, with matching text downloads. The minimal starter has
three records across two collections. The existing external site supplies
32 records across five collections. Browser verification requires
a local browser installation; automated build checks do not measure frame rate.
