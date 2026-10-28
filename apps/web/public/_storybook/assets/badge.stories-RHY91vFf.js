import{a6 as c,cq as p,bq as n,j as e,C as m,e as x,f as u,m as B}from"./iframe-BjN4PNZi.js";import{B as h}from"./bug-D_gBXHGa.js";import"./preload-helper-PPVm8Dsz.js";const l={name:"sparkles",size:24,node:[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],aliases:["stars"]};l.node;const f=c(l);const g={name:"zap",size:24,node:[["path",{d:"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z",key:"1v7up4"}]]};g.node;const v=c(g),k={title:"Data display/Badge",component:n,tags:["autodocs"],args:{children:"In review",tone:"accent",variant:"subtle",size:"md",dot:!1},argTypes:{tone:{control:"select",options:p},variant:{control:"inline-radio",options:["solid","subtle","outline"]},size:{control:"inline-radio",options:["sm","md"]}},parameters:{docs:{description:{component:"Badges label a state or a count. Choose the tone by meaning (`danger` for blocked,\n`success` for shipped), `subtle` by default, `solid` only for the one thing that must\nstand out, `outline` in dense tables."}}}},s={},r={render:()=>e.jsx("div",{className:"flex flex-col gap-3",children:["subtle","solid","outline"].map(a=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{variant:a,children:"Backlog"}),e.jsx(n,{variant:a,tone:"accent",children:"Beta"}),e.jsx(n,{variant:a,tone:"success",children:"Shipped"}),e.jsx(n,{variant:a,tone:"warning",children:"At risk"}),e.jsx(n,{variant:a,tone:"danger",children:"Blocked"}),e.jsx(n,{variant:a,tone:"info",children:"Triage"})]},a))})},t={render:()=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(n,{size:"sm",tone:"accent",children:"New"}),e.jsx(n,{size:"md",tone:"accent",children:"New"})]})},o={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{dot:!0,tone:"success",children:"Operational"}),e.jsx(n,{dot:!0,tone:"warning",children:"Degraded"}),e.jsx(n,{dot:!0,tone:"danger",children:"Outage"}),e.jsx(n,{icon:e.jsx(h,{}),tone:"danger",children:"Bug"}),e.jsx(n,{icon:e.jsx(f,{}),tone:"accent",children:"Feature"}),e.jsx(n,{icon:e.jsx(v,{}),tone:"warning",variant:"outline",children:"Performance"})]})},d={render:()=>e.jsxs("div",{className:"flex items-center gap-4 text-sm text-fg-muted",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:["Inbox",e.jsx(n,{size:"sm",tone:"accent",variant:"solid",children:"12"})]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:["My issues ",e.jsx(n,{size:"sm",children:"48"})]})]})},i={render:()=>e.jsx(m,{className:"w-96",children:e.jsxs(x,{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(u,{children:"Mobile app v3"}),e.jsx(n,{dot:!0,tone:"warning",size:"sm",children:"At risk"})]}),e.jsx(B,{children:"Offline sync slipped a week; 14 of 32 issues done."})]})})},y=["Playground","Tones","Sizes","WithDotOrIcon","Counts","InContext"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      {(["subtle", "solid", "outline"] as const).map(variant => <div key={variant} className="flex flex-wrap items-center gap-2">
          <Badge variant={variant}>Backlog</Badge>
          <Badge variant={variant} tone="accent">
            Beta
          </Badge>
          <Badge variant={variant} tone="success">
            Shipped
          </Badge>
          <Badge variant={variant} tone="warning">
            At risk
          </Badge>
          <Badge variant={variant} tone="danger">
            Blocked
          </Badge>
          <Badge variant={variant} tone="info">
            Triage
          </Badge>
        </div>)}
    </div>
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-2">
      <Badge size="sm" tone="accent">
        New
      </Badge>
      <Badge size="md" tone="accent">
        New
      </Badge>
    </div>
}`,...t.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <Badge dot tone="success">
        Operational
      </Badge>
      <Badge dot tone="warning">
        Degraded
      </Badge>
      <Badge dot tone="danger">
        Outage
      </Badge>
      <Badge icon={<Bug />} tone="danger">
        Bug
      </Badge>
      <Badge icon={<Sparkles />} tone="accent">
        Feature
      </Badge>
      <Badge icon={<Zap />} tone="warning" variant="outline">
        Performance
      </Badge>
    </div>
}`,...o.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4 text-sm text-fg-muted">
      <span className="flex items-center gap-1.5">
        Inbox
        <Badge size="sm" tone="accent" variant="solid">
          12
        </Badge>
      </span>
      <span className="flex items-center gap-1.5">
        My issues <Badge size="sm">48</Badge>
      </span>
    </div>
}`,...d.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-96">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Mobile app v3</CardTitle>
          <Badge dot tone="warning" size="sm">
            At risk
          </Badge>
        </div>
        <CardDescription>
          Offline sync slipped a week; 14 of 32 issues done.
        </CardDescription>
      </CardHeader>
    </Card>
}`,...i.parameters?.docs?.source}}};export{d as Counts,i as InContext,s as Playground,t as Sizes,r as Tones,o as WithDotOrIcon,y as __namedExportsOrder,k as default};
