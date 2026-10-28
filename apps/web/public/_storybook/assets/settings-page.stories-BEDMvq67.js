import{a6 as s,cQ as x,r as S,j as e,cR as w,cS as c,cT as t,J as y,b as g,L as v,B as p,p as f,t as M,v as I,cU as L,cV as m,cW as n,bA as j,cX as P}from"./iframe-BjN4PNZi.js";import{B}from"./bell-CVea3eBz.js";import{U}from"./users-CrbWFYk8.js";import{K as V}from"./key-round-BgM91_-8.js";import"./preload-helper-PPVm8Dsz.js";const k={name:"building-complex",size:24,node:[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]],aliases:["building-2"]};k.node;const _=s(k);const b={name:"credit-card",size:24,node:[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}],["path",{d:"M6 14h2",key:"mk7k0u"}]]};b.node;const E=s(b);const R={name:"palette",size:24,node:[["path",{d:"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",key:"e79jfc"}],["circle",{cx:"13.5",cy:"6.5",r:".5",fill:"currentColor",key:"1okk4w"}],["circle",{cx:"17.5",cy:"10.5",r:".5",fill:"currentColor",key:"f64h9f"}],["circle",{cx:"6.5",cy:"12.5",r:".5",fill:"currentColor",key:"qy21gx"}],["circle",{cx:"8.5",cy:"7.5",r:".5",fill:"currentColor",key:"fotxhn"}]]};R.node;const T=s(R);const z={name:"plug",size:24,node:[["path",{d:"M12 22v-5",key:"1ega77"}],["path",{d:"M15 8V2",key:"18g5xt"}],["path",{d:"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z",key:"1xoxul"}],["path",{d:"M9 8V2",key:"14iosj"}]]};z.node;const F=s(z);const D={name:"shield",size:24,node:[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]};D.node;const H=s(D);const N={name:"user",size:24,node:[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]};N.node;const A=s(N),q={title:"Patterns/SettingsPage",component:x,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Linear's settings: a nav of groups on the left (hidden on small screens), a centred column\nof sections on the right. Each `SettingsRow` puts the label and description on the left and\nthe control on the right, stacking on narrow widths."}}},args:{nav:null,children:null},argTypes:{nav:{control:!1},children:{control:!1}}};function u({value:a,options:l,onChange:d,label:h}){return e.jsx(M,{value:a,onValueChange:d,size:"sm","aria-label":h,className:"w-44",children:l.map(i=>e.jsx(I,{value:i,children:i},i))})}function C({active:a}){return e.jsxs(L,{back:e.jsx(P,{}),children:[e.jsxs(m,{label:"Account",icon:e.jsx(A,{}),children:[e.jsx(n,{active:a==="preferences",children:"Preferences"}),e.jsx(n,{children:"Profile"}),e.jsx(n,{icon:e.jsx(B,{}),children:"Notifications"}),e.jsx(n,{icon:e.jsx(H,{}),children:"Security & access"})]}),e.jsxs(m,{label:g.name,icon:e.jsx(v,{}),children:[e.jsx(n,{icon:e.jsx(_,{}),active:a==="workspace",children:"Workspace"}),e.jsx(n,{icon:e.jsx(U,{}),children:"Members"}),e.jsx(n,{icon:e.jsx(F,{}),children:"Integrations"}),e.jsx(n,{icon:e.jsx(V,{}),children:"API"}),e.jsx(n,{icon:e.jsx(E,{}),children:"Billing"})]}),e.jsxs(m,{label:"Your teams",children:[e.jsx(n,{icon:e.jsx(j,{name:"Engineering"}),children:"Engineering"}),e.jsx(n,{icon:e.jsx(j,{name:"Design",tone:"warning"}),children:"Design"})]})]})}const o={render:function(){const[l,d]=S.useState("System"),[h,i]=S.useState("Inbox");return e.jsx("div",{className:"h-dvh",children:e.jsxs(x,{nav:e.jsx(C,{active:"preferences"}),children:[e.jsx(w,{title:"Preferences",description:"Manage how the app looks and behaves for you."}),e.jsxs(c,{title:"General",children:[e.jsx(t,{label:"Default home view",description:"The page that opens when you start the app.",children:e.jsx(u,{label:"Default home view",value:h,options:["Inbox","My issues","Active issues"],onChange:i})}),e.jsx(t,{label:"Display full names",description:"Show full names of people instead of shorter usernames.",children:e.jsx(y,{"aria-label":"Display full names",defaultChecked:!0})}),e.jsx(t,{label:"First day of the week",description:"Used for date pickers and cycles.",children:e.jsx(u,{label:"First day of the week",value:"Monday",options:["Monday","Sunday"],onChange:()=>{}})})]}),e.jsxs(c,{title:"Interface and theme",children:[e.jsx(t,{label:"Interface theme",description:"Pick light, dark, or follow your system.",children:e.jsx(u,{label:"Interface theme",value:l,options:["System","Light","Dark"],onChange:d})}),e.jsx(t,{label:"Use pointer cursors",description:"Change the cursor to a pointer over interactive elements.",children:e.jsx(y,{"aria-label":"Use pointer cursors"})}),e.jsx(t,{label:"Accent colour",description:"Comes from the brand; edit brand.css to change it.",children:e.jsxs("span",{className:"inline-flex items-center gap-2 text-sm text-fg-muted",children:[e.jsx(T,{className:"size-4"})," Brand accent"]})})]})]})})}},r={render:()=>e.jsx("div",{className:"h-dvh",children:e.jsxs(x,{nav:e.jsx(C,{active:"workspace"}),children:[e.jsx(w,{title:"Workspace",description:`General settings for ${g.name}.`}),e.jsxs(c,{title:"Details",children:[e.jsxs(t,{label:"Logo",description:"Recommended size is 256×256px.",children:[e.jsx(v,{className:"size-8"}),e.jsx(p,{variant:"secondary",size:"sm",children:"Upload"})]}),e.jsx(t,{label:"Name",htmlFor:"ws-name",children:e.jsx(f,{id:"ws-name",size:"sm",defaultValue:g.name,className:"w-56"})}),e.jsx(t,{label:"URL",htmlFor:"ws-url",description:"Changing it breaks existing links.",children:e.jsx(f,{id:"ws-url",size:"sm",defaultValue:"acme",leading:e.jsx("span",{className:"text-xs",children:"app/"}),className:"w-56"})})]}),e.jsxs(c,{title:"Danger zone",description:"These actions can't be undone.",tone:"danger",children:[e.jsx(t,{label:"Export data",description:"Download all issues, projects and comments as CSV.",children:e.jsx(p,{variant:"secondary",size:"sm",children:"Export"})}),e.jsx(t,{label:"Delete workspace",description:"Permanently delete the workspace and everything in it.",children:e.jsx(p,{variant:"danger",size:"sm",children:"Delete workspace"})})]})]})})},J=["Preferences","Workspace"];o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [theme, setTheme] = useState("System");
    const [home, setHome] = useState("Inbox");
    return <div className="h-dvh">
        <SettingsLayout nav={<Nav active="preferences" />}>
          <SettingsHeader title="Preferences" description="Manage how the app looks and behaves for you." />
          <SettingsSection title="General">
            <SettingsRow label="Default home view" description="The page that opens when you start the app.">
              <OptionSelect label="Default home view" value={home} options={["Inbox", "My issues", "Active issues"]} onChange={setHome} />
            </SettingsRow>
            <SettingsRow label="Display full names" description="Show full names of people instead of shorter usernames.">
              <Switch aria-label="Display full names" defaultChecked />
            </SettingsRow>
            <SettingsRow label="First day of the week" description="Used for date pickers and cycles.">
              <OptionSelect label="First day of the week" value="Monday" options={["Monday", "Sunday"]} onChange={() => {}} />
            </SettingsRow>
          </SettingsSection>
          <SettingsSection title="Interface and theme">
            <SettingsRow label="Interface theme" description="Pick light, dark, or follow your system.">
              <OptionSelect label="Interface theme" value={theme} options={["System", "Light", "Dark"]} onChange={setTheme} />
            </SettingsRow>
            <SettingsRow label="Use pointer cursors" description="Change the cursor to a pointer over interactive elements.">
              <Switch aria-label="Use pointer cursors" />
            </SettingsRow>
            <SettingsRow label="Accent colour" description="Comes from the brand; edit brand.css to change it.">
              <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
                <Palette className="size-4" /> Brand accent
              </span>
            </SettingsRow>
          </SettingsSection>
        </SettingsLayout>
      </div>;
  }
}`,...o.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="h-dvh">
      <SettingsLayout nav={<Nav active="workspace" />}>
        <SettingsHeader title="Workspace" description={\`General settings for \${brand.name}.\`} />
        <SettingsSection title="Details">
          <SettingsRow label="Logo" description="Recommended size is 256×256px.">
            <LogoMark className="size-8" />
            <Button variant="secondary" size="sm">
              Upload
            </Button>
          </SettingsRow>
          <SettingsRow label="Name" htmlFor="ws-name">
            <Input id="ws-name" size="sm" defaultValue={brand.name} className="w-56" />
          </SettingsRow>
          <SettingsRow label="URL" htmlFor="ws-url" description="Changing it breaks existing links.">
            <Input id="ws-url" size="sm" defaultValue="acme" leading={<span className="text-xs">app/</span>} className="w-56" />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title="Danger zone" description="These actions can't be undone." tone="danger">
          <SettingsRow label="Export data" description="Download all issues, projects and comments as CSV.">
            <Button variant="secondary" size="sm">
              Export
            </Button>
          </SettingsRow>
          <SettingsRow label="Delete workspace" description="Permanently delete the workspace and everything in it.">
            <Button variant="danger" size="sm">
              Delete workspace
            </Button>
          </SettingsRow>
        </SettingsSection>
      </SettingsLayout>
    </div>
}`,...r.parameters?.docs?.source}}};export{o as Preferences,r as Workspace,J as __namedExportsOrder,q as default};
