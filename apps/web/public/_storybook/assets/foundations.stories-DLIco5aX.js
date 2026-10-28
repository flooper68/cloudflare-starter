import{j as e,L as g,a as x,b as i,B as m}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Foundations",parameters:{layout:"padded",docs:{description:{component:"The design foundations: brand, colour tokens, type scale and elevation. Everything is\ndefined by CSS variables in `src/styles/tokens.css` and `src/brand/brand.css`; switch\nthe theme in the toolbar to see both."}}}};function s({name:a,token:n,className:r}){return e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsx("div",{className:`h-14 rounded-md border border-line ${r}`}),e.jsx("div",{className:"text-xs font-medium text-fg",children:a}),e.jsx("code",{className:"font-mono text-2xs text-fg-subtle",children:n})]})}function t({title:a,description:n,children:r}){return e.jsxs("section",{className:"flex flex-col gap-3",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-sm font-semibold text-fg",children:a}),n?e.jsx("p",{className:"text-xs text-fg-muted",children:n}):null]}),r]})}const c={render:()=>e.jsxs("div",{className:"flex max-w-3xl flex-col gap-8",children:[e.jsx(t,{title:"Identity",description:"src/brand/brand.tsx: name, tagline, logo. src/brand/brand.css: accent, fonts, radius.",children:e.jsxs("div",{className:"flex items-center gap-6 rounded-lg border border-line bg-surface p-6",children:[e.jsx(g,{className:"size-12"}),e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsx(x,{}),e.jsx("p",{className:"text-sm text-fg-muted",children:i.tagline})]})]})}),e.jsxs(t,{title:"Accent",description:"One brand colour; hover, tint and focus ring derive from it.",children:[e.jsxs("div",{className:"grid grid-cols-4 gap-4",children:[e.jsx(s,{name:"Accent",token:"--brand-accent",className:"bg-accent"}),e.jsx(s,{name:"Accent hover",token:"derived",className:"bg-accent-hover"}),e.jsx(s,{name:"Accent subtle",token:"derived",className:"bg-accent-subtle"}),e.jsx(s,{name:"Focus ring",token:"derived",className:"bg-focus"})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsx(m,{variant:"primary",children:"Primary action"}),e.jsx(m,{children:"Secondary"}),e.jsx(m,{variant:"link",children:"Link"})]})]}),e.jsxs(t,{title:"Type",description:`Sans: ${i.fonts.sans}. Mono: ${i.fonts.mono}.`,children:[e.jsx("p",{className:"text-2xl font-semibold tracking-tight",children:"The quick brown fox ships the release"}),e.jsx("p",{className:"font-mono text-sm text-fg-muted",children:"ENG-1284 · fix(auth): rotate keys"})]})]})},o={render:()=>e.jsxs("div",{className:"flex max-w-4xl flex-col gap-8",children:[e.jsx(t,{title:"Surfaces",description:"From the page background up to floating panels.",children:e.jsxs("div",{className:"grid grid-cols-4 gap-4",children:[e.jsx(s,{name:"Canvas",token:"bg-canvas",className:"bg-canvas"}),e.jsx(s,{name:"Surface",token:"bg-surface",className:"bg-surface"}),e.jsx(s,{name:"Raised",token:"bg-surface-raised",className:"bg-surface-raised"}),e.jsx(s,{name:"Overlay",token:"bg-overlay",className:"bg-overlay"}),e.jsx(s,{name:"Input",token:"bg-input",className:"bg-input"}),e.jsx(s,{name:"Hover",token:"bg-hover",className:"bg-hover"}),e.jsx(s,{name:"Active",token:"bg-active",className:"bg-active"}),e.jsx(s,{name:"Backdrop",token:"bg-backdrop",className:"bg-backdrop"})]})}),e.jsx(t,{title:"Text and lines",children:e.jsxs("div",{className:"grid grid-cols-4 gap-4",children:[e.jsx(s,{name:"Foreground",token:"text-fg",className:"bg-fg"}),e.jsx(s,{name:"Muted",token:"text-fg-muted",className:"bg-fg-muted"}),e.jsx(s,{name:"Subtle",token:"text-fg-subtle",className:"bg-fg-subtle"}),e.jsx(s,{name:"Line strong",token:"border-line-strong",className:"bg-line-strong"})]})}),e.jsx(t,{title:"Status",description:"Solid for icons and text, subtle for backgrounds.",children:e.jsxs("div",{className:"grid grid-cols-4 gap-4",children:[e.jsx(s,{name:"Success",token:"success",className:"bg-success"}),e.jsx(s,{name:"Warning",token:"warning",className:"bg-warning"}),e.jsx(s,{name:"Danger",token:"danger",className:"bg-danger"}),e.jsx(s,{name:"Info",token:"info",className:"bg-info"}),e.jsx(s,{name:"Success subtle",token:"success-subtle",className:"bg-success-subtle"}),e.jsx(s,{name:"Warning subtle",token:"warning-subtle",className:"bg-warning-subtle"}),e.jsx(s,{name:"Danger subtle",token:"danger-subtle",className:"bg-danger-subtle"}),e.jsx(s,{name:"Info subtle",token:"info-subtle",className:"bg-info-subtle"})]})})]})},b=[["text-2xl","24 / 32","Page titles"],["text-xl","20 / 28","Section titles"],["text-lg","16 / 24","Dialog titles"],["text-base","14 / 22","Card titles, emphasis"],["text-sm","13 / 20","Body, controls (default)"],["text-xs","12 / 16","Labels, metadata"],["text-2xs","11 / 16","Keys, counters"]],l={render:()=>e.jsxs("div",{className:"flex max-w-3xl flex-col gap-4",children:[b.map(([a,n,r])=>e.jsxs("div",{className:"grid grid-cols-[120px_80px_1fr] items-baseline gap-4 border-b border-line pb-3",children:[e.jsx("code",{className:"font-mono text-xs text-fg-subtle",children:a}),e.jsx("span",{className:"text-xs text-fg-muted",children:n}),e.jsx("span",{className:`${a} font-medium text-fg`,children:r})]},a)),e.jsxs("div",{className:"flex gap-6 pt-2 text-sm",children:[e.jsx("span",{className:"font-normal",children:"Regular 400"}),e.jsx("span",{className:"font-medium",children:"Medium 500"}),e.jsx("span",{className:"font-semibold",children:"Semibold 600"})]})]})},d={render:()=>e.jsxs("div",{className:"grid max-w-3xl grid-cols-3 gap-6",children:[[["Surface","bg-surface border border-line"],["Raised","bg-surface-raised border border-line shadow-raised"],["Overlay","bg-overlay border border-line shadow-overlay"]].map(([a,n])=>e.jsx("div",{className:`flex h-28 items-end rounded-lg p-3 ${n}`,children:e.jsx("span",{className:"text-xs text-fg-muted",children:a})},a)),["rounded-sm","rounded-md","rounded-lg","rounded-xl"].map(a=>e.jsx("div",{className:`flex h-16 items-center justify-center border border-line-strong bg-surface ${a}`,children:e.jsx("code",{className:"font-mono text-xs text-fg-muted",children:a})},a))]})},N=["Brand","Colors","Typography","Elevation"];c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex max-w-3xl flex-col gap-8">
      <Section title="Identity" description="src/brand/brand.tsx: name, tagline, logo. src/brand/brand.css: accent, fonts, radius.">
        <div className="flex items-center gap-6 rounded-lg border border-line bg-surface p-6">
          <LogoMark className="size-12" />
          <div className="flex flex-col gap-1">
            <Logo />
            <p className="text-sm text-fg-muted">{brand.tagline}</p>
          </div>
        </div>
      </Section>
      <Section title="Accent" description="One brand colour; hover, tint and focus ring derive from it.">
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Accent" token="--brand-accent" className="bg-accent" />
          <Swatch name="Accent hover" token="derived" className="bg-accent-hover" />
          <Swatch name="Accent subtle" token="derived" className="bg-accent-subtle" />
          <Swatch name="Focus ring" token="derived" className="bg-focus" />
        </div>
        <div className="flex gap-3">
          <Button variant="primary">Primary action</Button>
          <Button>Secondary</Button>
          <Button variant="link">Link</Button>
        </div>
      </Section>
      <Section title="Type" description={\`Sans: \${brand.fonts.sans}. Mono: \${brand.fonts.mono}.\`}>
        <p className="text-2xl font-semibold tracking-tight">
          The quick brown fox ships the release
        </p>
        <p className="font-mono text-sm text-fg-muted">
          ENG-1284 · fix(auth): rotate keys
        </p>
      </Section>
    </div>
}`,...c.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex max-w-4xl flex-col gap-8">
      <Section title="Surfaces" description="From the page background up to floating panels.">
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Canvas" token="bg-canvas" className="bg-canvas" />
          <Swatch name="Surface" token="bg-surface" className="bg-surface" />
          <Swatch name="Raised" token="bg-surface-raised" className="bg-surface-raised" />
          <Swatch name="Overlay" token="bg-overlay" className="bg-overlay" />
          <Swatch name="Input" token="bg-input" className="bg-input" />
          <Swatch name="Hover" token="bg-hover" className="bg-hover" />
          <Swatch name="Active" token="bg-active" className="bg-active" />
          <Swatch name="Backdrop" token="bg-backdrop" className="bg-backdrop" />
        </div>
      </Section>
      <Section title="Text and lines">
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Foreground" token="text-fg" className="bg-fg" />
          <Swatch name="Muted" token="text-fg-muted" className="bg-fg-muted" />
          <Swatch name="Subtle" token="text-fg-subtle" className="bg-fg-subtle" />
          <Swatch name="Line strong" token="border-line-strong" className="bg-line-strong" />
        </div>
      </Section>
      <Section title="Status" description="Solid for icons and text, subtle for backgrounds.">
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Success" token="success" className="bg-success" />
          <Swatch name="Warning" token="warning" className="bg-warning" />
          <Swatch name="Danger" token="danger" className="bg-danger" />
          <Swatch name="Info" token="info" className="bg-info" />
          <Swatch name="Success subtle" token="success-subtle" className="bg-success-subtle" />
          <Swatch name="Warning subtle" token="warning-subtle" className="bg-warning-subtle" />
          <Swatch name="Danger subtle" token="danger-subtle" className="bg-danger-subtle" />
          <Swatch name="Info subtle" token="info-subtle" className="bg-info-subtle" />
        </div>
      </Section>
    </div>
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex max-w-3xl flex-col gap-4">
      {typeScale.map(([token, size, use]) => <div key={token} className="grid grid-cols-[120px_80px_1fr] items-baseline gap-4 border-b border-line pb-3">
          <code className="font-mono text-xs text-fg-subtle">{token}</code>
          <span className="text-xs text-fg-muted">{size}</span>
          <span className={\`\${token} font-medium text-fg\`}>{use}</span>
        </div>)}
      <div className="flex gap-6 pt-2 text-sm">
        <span className="font-normal">Regular 400</span>
        <span className="font-medium">Medium 500</span>
        <span className="font-semibold">Semibold 600</span>
      </div>
    </div>
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid max-w-3xl grid-cols-3 gap-6">
      {[["Surface", "bg-surface border border-line"], ["Raised", "bg-surface-raised border border-line shadow-raised"], ["Overlay", "bg-overlay border border-line shadow-overlay"]].map(([name, classes]) => <div key={name} className={\`flex h-28 items-end rounded-lg p-3 \${classes}\`}>
          <span className="text-xs text-fg-muted">{name}</span>
        </div>)}
      {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"].map(radius => <div key={radius} className={\`flex h-16 items-center justify-center border border-line-strong bg-surface \${radius}\`}>
            <code className="font-mono text-xs text-fg-muted">{radius}</code>
          </div>)}
    </div>
}`,...d.parameters?.docs?.source}}};export{c as Brand,o as Colors,d as Elevation,l as Typography,N as __namedExportsOrder,p as default};
