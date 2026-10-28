import{aZ as g,j as e,a_ as a,a$ as f,aV as x,r as u,B as h,b0 as c}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const S={title:"Feedback/Skeleton",component:g,tags:["autodocs"],args:{className:"h-4 w-48"},parameters:{docs:{description:{component:"Placeholders that keep the layout steady while content loads. Match the shape of the\nreal content; prefer presets (`SkeletonText`, `SkeletonAvatar`, `SkeletonCard`,\n`SkeletonListRow`) and size a bare `Skeleton` with classes for anything else. Mark\nthe loading region with `aria-busy`."}}}},n={},o={render:()=>e.jsxs("div",{className:"flex w-80 flex-col gap-6",children:[e.jsx(c,{lines:1}),e.jsx(c,{lines:3}),e.jsx(c,{lines:5})]})},i={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(a,{size:"xs"}),e.jsx(a,{size:"sm"}),e.jsx(a,{size:"md"}),e.jsx(a,{size:"lg"}),e.jsx(a,{size:"xl"})]})},l={render:()=>e.jsx(f,{className:"w-80"})},d={render:()=>e.jsx("div",{className:"w-[30rem] rounded-lg border border-line bg-surface-raised",children:Array.from({length:5},(b,r)=>e.jsx(x,{className:"border-b border-line last:border-b-0"},r))})},p=[{id:"ENG-142",title:"Login redirect loops when the session expires",who:"TN"},{id:"ENG-139",title:"Add rate limiting to the public API",who:"JD"},{id:"ENG-131",title:"Dark mode: chart tooltips are unreadable",who:"MS"}],t={render:function(){const[r,m]=u.useState(!0);return u.useEffect(()=>{if(!r)return;const s=setTimeout(()=>m(!1),1200);return()=>clearTimeout(s)},[r]),e.jsxs("div",{className:"flex w-[30rem] flex-col gap-3",children:[e.jsx("div",{"aria-busy":r,className:"rounded-lg border border-line bg-surface-raised",children:r?p.map(s=>e.jsx(x,{className:"border-b border-line last:border-b-0"},s.id)):p.map(s=>e.jsxs("div",{className:"flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0",children:[e.jsx("span",{className:"size-3.5 shrink-0 rounded-full border-2 border-fg-subtle"}),e.jsx("span",{className:"w-14 shrink-0 text-xs text-fg-subtle",children:s.id}),e.jsx("span",{className:"flex-1 truncate",children:s.title}),e.jsx("span",{className:"flex size-5 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent",children:s.who})]},s.id))}),e.jsx(h,{size:"sm",className:"self-start",onClick:()=>m(!0),children:"Reload"})]})}},w=["Playground","Text","Avatars","Card","ListRows","LoadingThenLoaded"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex w-80 flex-col gap-6">
      <SkeletonText lines={1} />
      <SkeletonText lines={3} />
      <SkeletonText lines={5} />
    </div>
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <SkeletonAvatar size="xs" />
      <SkeletonAvatar size="sm" />
      <SkeletonAvatar size="md" />
      <SkeletonAvatar size="lg" />
      <SkeletonAvatar size="xl" />
    </div>
}`,...i.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <SkeletonCard className="w-80" />
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-[30rem] rounded-lg border border-line bg-surface-raised">
      {Array.from({
      length: 5
    }, (_, index) => <SkeletonListRow
    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
    key={index} className="border-b border-line last:border-b-0" />)}
    </div>
}`,...d.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      if (!loading) return;
      const timer = setTimeout(() => setLoading(false), 1200);
      return () => clearTimeout(timer);
    }, [loading]);
    return <div className="flex w-[30rem] flex-col gap-3">
        <div aria-busy={loading} className="rounded-lg border border-line bg-surface-raised">
          {loading ? issues.map(issue => <SkeletonListRow key={issue.id} className="border-b border-line last:border-b-0" />) : issues.map(issue => <div key={issue.id} className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0">
                  <span className="size-3.5 shrink-0 rounded-full border-2 border-fg-subtle" />
                  <span className="w-14 shrink-0 text-xs text-fg-subtle">
                    {issue.id}
                  </span>
                  <span className="flex-1 truncate">{issue.title}</span>
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent">
                    {issue.who}
                  </span>
                </div>)}
        </div>
        <Button size="sm" className="self-start" onClick={() => setLoading(true)}>
          Reload
        </Button>
      </div>;
  }
}`,...t.parameters?.docs?.source},description:{story:"An issue list that loads for a second, then shows the rows.",...t.parameters?.docs?.description}}};export{i as Avatars,l as Card,d as ListRows,t as LoadingThenLoaded,n as Playground,o as Text,w as __namedExportsOrder,S as default};
