--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg120+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.hornet_hornet DROP CONSTRAINT hornet_hornet_linked_nest_id_c88a54e6_fk_hornet_nest_id;
ALTER TABLE ONLY public.django_admin_log DROP CONSTRAINT django_admin_log_user_id_c564eba6_fk_auth_user_id;
ALTER TABLE ONLY public.django_admin_log DROP CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co;
ALTER TABLE ONLY public.auth_user_user_permissions DROP CONSTRAINT auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id;
ALTER TABLE ONLY public.auth_user_user_permissions DROP CONSTRAINT auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm;
ALTER TABLE ONLY public.auth_user_groups DROP CONSTRAINT auth_user_groups_user_id_6a12ed8b_fk_auth_user_id;
ALTER TABLE ONLY public.auth_user_groups DROP CONSTRAINT auth_user_groups_group_id_97559544_fk_auth_group_id;
ALTER TABLE ONLY public.auth_permission DROP CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co;
ALTER TABLE ONLY public.auth_group_permissions DROP CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id;
ALTER TABLE ONLY public.auth_group_permissions DROP CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm;
DROP INDEX public.hornet_nest_point_ef559bda_id;
DROP INDEX public.hornet_hornet_point_dfe572f2_id;
DROP INDEX public.hornet_hornet_linked_nest_id_c88a54e6;
DROP INDEX public.hornet_apiary_point_02de679b_id;
DROP INDEX public.django_session_session_key_c0390e0f_like;
DROP INDEX public.django_session_expire_date_a5c62663;
DROP INDEX public.django_admin_log_user_id_c564eba6;
DROP INDEX public.django_admin_log_content_type_id_c4bce8eb;
DROP INDEX public.auth_user_username_6821ab7c_like;
DROP INDEX public.auth_user_user_permissions_user_id_a95ead1b;
DROP INDEX public.auth_user_user_permissions_permission_id_1fbb5f2c;
DROP INDEX public.auth_user_groups_user_id_6a12ed8b;
DROP INDEX public.auth_user_groups_group_id_97559544;
DROP INDEX public.auth_permission_content_type_id_2f476e4b;
DROP INDEX public.auth_group_permissions_permission_id_84c5c92e;
DROP INDEX public.auth_group_permissions_group_id_b120cbf9;
DROP INDEX public.auth_group_name_a6ea08ec_like;
ALTER TABLE ONLY public.hornet_nest DROP CONSTRAINT hornet_nest_pkey;
ALTER TABLE ONLY public.hornet_hornet DROP CONSTRAINT hornet_hornet_pkey;
ALTER TABLE ONLY public.hornet_apiary DROP CONSTRAINT hornet_apiary_pkey;
ALTER TABLE ONLY public.django_session DROP CONSTRAINT django_session_pkey;
ALTER TABLE ONLY public.django_migrations DROP CONSTRAINT django_migrations_pkey;
ALTER TABLE ONLY public.django_content_type DROP CONSTRAINT django_content_type_pkey;
ALTER TABLE ONLY public.django_content_type DROP CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq;
ALTER TABLE ONLY public.django_admin_log DROP CONSTRAINT django_admin_log_pkey;
ALTER TABLE ONLY public.auth_user DROP CONSTRAINT auth_user_username_key;
ALTER TABLE ONLY public.auth_user_user_permissions DROP CONSTRAINT auth_user_user_permissions_user_id_permission_id_14a6b632_uniq;
ALTER TABLE ONLY public.auth_user_user_permissions DROP CONSTRAINT auth_user_user_permissions_pkey;
ALTER TABLE ONLY public.auth_user DROP CONSTRAINT auth_user_pkey;
ALTER TABLE ONLY public.auth_user_groups DROP CONSTRAINT auth_user_groups_user_id_group_id_94350c0c_uniq;
ALTER TABLE ONLY public.auth_user_groups DROP CONSTRAINT auth_user_groups_pkey;
ALTER TABLE ONLY public.auth_permission DROP CONSTRAINT auth_permission_pkey;
ALTER TABLE ONLY public.auth_permission DROP CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq;
ALTER TABLE ONLY public.auth_group DROP CONSTRAINT auth_group_pkey;
ALTER TABLE ONLY public.auth_group_permissions DROP CONSTRAINT auth_group_permissions_pkey;
ALTER TABLE ONLY public.auth_group_permissions DROP CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq;
ALTER TABLE ONLY public.auth_group DROP CONSTRAINT auth_group_name_key;
DROP TABLE public.hornet_nest;
DROP TABLE public.hornet_hornet;
DROP TABLE public.hornet_apiary;
DROP TABLE public.django_session;
DROP TABLE public.django_migrations;
DROP TABLE public.django_content_type;
DROP TABLE public.django_admin_log;
DROP TABLE public.auth_user_user_permissions;
DROP TABLE public.auth_user_groups;
DROP TABLE public.auth_user;
DROP TABLE public.auth_permission;
DROP TABLE public.auth_group_permissions;
DROP TABLE public.auth_group;
DROP EXTENSION postgis_topology;
DROP EXTENSION postgis_tiger_geocoder;
DROP EXTENSION postgis;
DROP EXTENSION fuzzystrmatch;
DROP SCHEMA topology;
DROP SCHEMA tiger_data;
DROP SCHEMA tiger;
--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: hornet_finder
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO hornet_finder;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: hornet_finder
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO hornet_finder;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: hornet_finder
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO hornet_finder;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: hornet_finder
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_group; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_group (
    id integer NOT NULL,
    name character varying(150) NOT NULL
);


ALTER TABLE public.auth_group OWNER TO hornet_finder;

--
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_group_permissions; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_group_permissions (
    id bigint NOT NULL,
    group_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_group_permissions OWNER TO hornet_finder;

--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_group_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_permission; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_permission (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    content_type_id integer NOT NULL,
    codename character varying(100) NOT NULL
);


ALTER TABLE public.auth_permission OWNER TO hornet_finder;

--
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_user; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_user (
    id integer NOT NULL,
    password character varying(128) NOT NULL,
    last_login timestamp with time zone,
    is_superuser boolean NOT NULL,
    username character varying(150) NOT NULL,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(254) NOT NULL,
    is_staff boolean NOT NULL,
    is_active boolean NOT NULL,
    date_joined timestamp with time zone NOT NULL
);


ALTER TABLE public.auth_user OWNER TO hornet_finder;

--
-- Name: auth_user_groups; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_user_groups (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.auth_user_groups OWNER TO hornet_finder;

--
-- Name: auth_user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_user_groups ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_user_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_user ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_user_user_permissions; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.auth_user_user_permissions (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_user_user_permissions OWNER TO hornet_finder;

--
-- Name: auth_user_user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.auth_user_user_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_admin_log; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.django_admin_log (
    id integer NOT NULL,
    action_time timestamp with time zone NOT NULL,
    object_id text,
    object_repr character varying(200) NOT NULL,
    action_flag smallint NOT NULL,
    change_message text NOT NULL,
    content_type_id integer,
    user_id integer NOT NULL,
    CONSTRAINT django_admin_log_action_flag_check CHECK ((action_flag >= 0))
);


ALTER TABLE public.django_admin_log OWNER TO hornet_finder;

--
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.django_admin_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_content_type; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.django_content_type (
    id integer NOT NULL,
    app_label character varying(100) NOT NULL,
    model character varying(100) NOT NULL
);


ALTER TABLE public.django_content_type OWNER TO hornet_finder;

--
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.django_content_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_migrations; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.django_migrations (
    id bigint NOT NULL,
    app character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);


ALTER TABLE public.django_migrations OWNER TO hornet_finder;

--
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.django_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_session; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.django_session (
    session_key character varying(40) NOT NULL,
    session_data text NOT NULL,
    expire_date timestamp with time zone NOT NULL
);


ALTER TABLE public.django_session OWNER TO hornet_finder;

--
-- Name: hornet_apiary; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.hornet_apiary (
    id integer NOT NULL,
    longitude double precision NOT NULL,
    latitude double precision NOT NULL,
    infestation_level integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    created_by character varying(255),
    comments text,
    point public.geography(Point,4326)
);


ALTER TABLE public.hornet_apiary OWNER TO hornet_finder;

--
-- Name: hornet_apiary_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.hornet_apiary ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.hornet_apiary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hornet_hornet; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.hornet_hornet (
    id integer NOT NULL,
    longitude double precision NOT NULL,
    latitude double precision NOT NULL,
    direction integer NOT NULL,
    duration integer,
    created_at timestamp with time zone NOT NULL,
    created_by character varying(255),
    linked_nest_id integer,
    mark_color_1 character varying(20) NOT NULL,
    mark_color_2 character varying(20) NOT NULL,
    point public.geography(Point,4326)
);


ALTER TABLE public.hornet_hornet OWNER TO hornet_finder;

--
-- Name: hornet_hornet_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.hornet_hornet ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.hornet_hornet_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hornet_nest; Type: TABLE; Schema: public; Owner: hornet_finder
--

CREATE TABLE public.hornet_nest (
    id integer NOT NULL,
    longitude double precision NOT NULL,
    latitude double precision NOT NULL,
    public_place boolean NOT NULL,
    address character varying(255) NOT NULL,
    destroyed boolean NOT NULL,
    destroyed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    comments text,
    created_by character varying(255),
    point public.geography(Point,4326)
);


ALTER TABLE public.hornet_nest OWNER TO hornet_finder;

--
-- Name: hornet_nest_id_seq; Type: SEQUENCE; Schema: public; Owner: hornet_finder
--

ALTER TABLE public.hornet_nest ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.hornet_nest_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: auth_group; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_group (id, name) FROM stdin;
\.


--
-- Data for Name: auth_group_permissions; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_group_permissions (id, group_id, permission_id) FROM stdin;
\.


--
-- Data for Name: auth_permission; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_permission (id, name, content_type_id, codename) FROM stdin;
1	Can add log entry	1	add_logentry
2	Can change log entry	1	change_logentry
3	Can delete log entry	1	delete_logentry
4	Can view log entry	1	view_logentry
5	Can add permission	2	add_permission
6	Can change permission	2	change_permission
7	Can delete permission	2	delete_permission
8	Can view permission	2	view_permission
9	Can add group	3	add_group
10	Can change group	3	change_group
11	Can delete group	3	delete_group
12	Can view group	3	view_group
13	Can add user	4	add_user
14	Can change user	4	change_user
15	Can delete user	4	delete_user
16	Can view user	4	view_user
17	Can add content type	5	add_contenttype
18	Can change content type	5	change_contenttype
19	Can delete content type	5	delete_contenttype
20	Can view content type	5	view_contenttype
21	Can add session	6	add_session
22	Can change session	6	change_session
23	Can delete session	6	delete_session
24	Can view session	6	view_session
25	Can add apiary	7	add_apiary
26	Can change apiary	7	change_apiary
27	Can delete apiary	7	delete_apiary
28	Can view apiary	7	view_apiary
29	Can add nest	8	add_nest
30	Can change nest	8	change_nest
31	Can delete nest	8	delete_nest
32	Can view nest	8	view_nest
33	Can add hornet	9	add_hornet
34	Can change hornet	9	change_hornet
35	Can delete hornet	9	delete_hornet
36	Can view hornet	9	view_hornet
\.


--
-- Data for Name: auth_user; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_user (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined) FROM stdin;
\.


--
-- Data for Name: auth_user_groups; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_user_groups (id, user_id, group_id) FROM stdin;
\.


--
-- Data for Name: auth_user_user_permissions; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.auth_user_user_permissions (id, user_id, permission_id) FROM stdin;
\.


--
-- Data for Name: django_admin_log; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.django_admin_log (id, action_time, object_id, object_repr, action_flag, change_message, content_type_id, user_id) FROM stdin;
\.


--
-- Data for Name: django_content_type; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.django_content_type (id, app_label, model) FROM stdin;
1	admin	logentry
2	auth	permission
3	auth	group
4	auth	user
5	contenttypes	contenttype
6	sessions	session
7	hornet	apiary
8	hornet	nest
9	hornet	hornet
\.


--
-- Data for Name: django_migrations; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.django_migrations (id, app, name, applied) FROM stdin;
1	contenttypes	0001_initial	2025-07-22 21:39:06.640164+00
2	auth	0001_initial	2025-07-22 21:39:06.684872+00
3	admin	0001_initial	2025-07-22 21:39:06.699327+00
4	admin	0002_logentry_remove_auto_add	2025-07-22 21:39:06.70757+00
5	admin	0003_logentry_add_action_flag_choices	2025-07-22 21:39:06.715026+00
6	contenttypes	0002_remove_content_type_name	2025-07-22 21:39:06.737427+00
7	auth	0002_alter_permission_name_max_length	2025-07-22 21:39:06.748232+00
8	auth	0003_alter_user_email_max_length	2025-07-22 21:39:06.757623+00
9	auth	0004_alter_user_username_opts	2025-07-22 21:39:06.765969+00
10	auth	0005_alter_user_last_login_null	2025-07-22 21:39:06.774526+00
11	auth	0006_require_contenttypes_0002	2025-07-22 21:39:06.776156+00
12	auth	0007_alter_validators_add_error_messages	2025-07-22 21:39:06.784772+00
13	auth	0008_alter_user_username_max_length	2025-07-22 21:39:06.795406+00
14	auth	0009_alter_user_last_name_max_length	2025-07-22 21:39:06.804471+00
15	auth	0010_alter_group_name_max_length	2025-07-22 21:39:06.813742+00
16	auth	0011_update_proxy_permissions	2025-07-22 21:39:06.821703+00
17	auth	0012_alter_user_first_name_max_length	2025-07-22 21:39:06.830026+00
18	hornet	0001_initial	2025-07-22 21:39:06.855862+00
19	hornet	0002_add_color_marking	2025-07-22 21:39:06.866329+00
20	hornet	0003_nest_created_by_alter_nest_address	2025-07-22 21:39:06.875887+00
21	hornet	0004_apiary_point_hornet_point_nest_point	2025-07-22 21:39:06.930036+00
22	sessions	0001_initial	2025-07-22 21:39:06.939454+00
\.


--
-- Data for Name: django_session; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.django_session (session_key, session_data, expire_date) FROM stdin;
\.


--
-- Data for Name: hornet_apiary; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.hornet_apiary (id, longitude, latitude, infestation_level, created_at, created_by, comments, point) FROM stdin;
2	4.867455661296845	50.50927830132975	1	2025-07-26 20:12:36.044866+00	eric.devolder@gmail.com	Rucher Benja	0101000020E61000000100004C467813400963080830414940
3	4.872103929519654	50.50341353576245	2	2025-07-26 20:13:12.95786+00	eric.devolder@gmail.com	Rucher Bérengère	0101000020E6100000010000D0087D1340523BD0DA6F404940
4	4.867707788944244	50.5016409981843	2	2025-07-26 20:14:08.26081+00	eric.devolder@gmail.com	Rucher Barbara	0101000020E6100000000000648878134066C4B0C535404940
5	4.873933196067811	50.51059342363469	2	2025-07-26 20:15:08.944175+00	eric.devolder@gmail.com	Rucher Madeleine	0101000020E610000001000058E87E1340260814205B414940
6	4.884978532791139	50.497322825043575	2	2025-07-26 20:15:48.70926+00	eric.devolder@gmail.com	Rucher Benoît	0101000020E6100000010000D0378A1340E98E3A46A83F4940
7	4.856463968753816	50.481882682120435	1	2025-07-26 20:17:04.351088+00	eric.devolder@gmail.com	Rucher Yves	0101000020E6100000010000E4046D1340A71BEC54AE3D4940
8	4.8733699321746835	50.49134395188796	2	2025-07-26 20:19:09.17534+00	eric.devolder@gmail.com	Rucher Françoise	0101000020E6100000010000B0547E13401D39CE5BE43E4940
1	4.884114861488343	50.490227948271816	2	2025-07-22 22:21:37.450581+00	eric.devolder@gmail.com	Rucher Eric	0101000020E61000000100006855891340D1B416CABF3E4940
\.


--
-- Data for Name: hornet_hornet; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.hornet_hornet (id, longitude, latitude, direction, duration, created_at, created_by, linked_nest_id, mark_color_1, mark_color_2, point) FROM stdin;
6	4.88344967365265	50.49153769338963	248	\N	2025-07-22 08:41:59.895534+00	eric.devolder@gmail.com	\N			0101000020E610000001000008A78813400CEE06B5EA3E4940
7	4.883611111111111	50.49138888888889	40	\N	2025-07-22 08:45:27.498636+00	eric.devolder@gmail.com	\N			0101000020E6100000F36AE259D1881340A2B2C3D4E53E4940
9	4.880277777777779	50.49166666666667	53	\N	2025-07-22 22:23:23.191942+00	eric.devolder@gmail.com	\N	yellow		0101000020E6100000F1CDAB8967851340EFEEEEEEEE3E4940
11	4.8829422	50.5031789	141	\N	2025-07-23 17:46:55.288435+00	eric.devolder@gmail.com	\N	purple		0101000020E61000007D08050022881340C5C48B2A68404940
14	4.88299226	50.503176	16	\N	2025-07-26 18:15:15.60292+00	eric.devolder@gmail.com	\N	yellow		0101000020E6100000D6487D1F2F881340E910381268404940
8	4.880277777777779	50.49166666666667	33	\N	2025-07-22 22:22:40.479817+00	eric.devolder@gmail.com	\N	purple		0101000020E6100000F1CDAB8967851340EFEEEEEEEE3E4940
15	4.880374799	50.4917446	145	\N	2025-07-28 17:21:32.526732+00	eric.devolder@gmail.com	\N	pink		0101000020E6100000D6B5A7F880851340077EAF7CF13E4940
\.


--
-- Data for Name: hornet_nest; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.hornet_nest (id, longitude, latitude, public_place, address, destroyed, destroyed_at, created_at, comments, created_by, point) FROM stdin;
1	4.86425	50.477577	f		t	2025-07-26 12:53:13.650058+00	2025-07-26 13:14:11.665462+00	\N	martin.devolder2@gmail.com	0101000020E6100000A245B6F3FD74134030293E3E213D4940
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: hornet_finder
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: hornet_finder
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: hornet_finder
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: hornet_finder
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: hornet_finder
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: hornet_finder
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: hornet_finder
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: auth_group_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_group_id_seq', 1, false);


--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_group_permissions_id_seq', 1, false);


--
-- Name: auth_permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_permission_id_seq', 66, true);


--
-- Name: auth_user_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_user_groups_id_seq', 1, false);


--
-- Name: auth_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_user_id_seq', 1, false);


--
-- Name: auth_user_user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.auth_user_user_permissions_id_seq', 1, false);


--
-- Name: django_admin_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.django_admin_log_id_seq', 1, false);


--
-- Name: django_content_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.django_content_type_id_seq', 33, true);


--
-- Name: django_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.django_migrations_id_seq', 33, true);


--
-- Name: hornet_apiary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.hornet_apiary_id_seq', 8, true);


--
-- Name: hornet_hornet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.hornet_hornet_id_seq', 15, true);


--
-- Name: hornet_nest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hornet_finder
--

SELECT pg_catalog.setval('public.hornet_nest_id_seq', 1, true);


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: hornet_finder
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: auth_group auth_group_name_key; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_name_key UNIQUE (name);


--
-- Name: auth_group_permissions auth_group_permissions_group_id_permission_id_0cd325b0_uniq; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id);


--
-- Name: auth_group_permissions auth_group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id);


--
-- Name: auth_group auth_group_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_pkey PRIMARY KEY (id);


--
-- Name: auth_permission auth_permission_content_type_id_codename_01ab375a_uniq; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename);


--
-- Name: auth_permission auth_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_pkey PRIMARY KEY (id);


--
-- Name: auth_user_groups auth_user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_pkey PRIMARY KEY (id);


--
-- Name: auth_user_groups auth_user_groups_user_id_group_id_94350c0c_uniq; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_user_id_group_id_94350c0c_uniq UNIQUE (user_id, group_id);


--
-- Name: auth_user auth_user_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_pkey PRIMARY KEY (id);


--
-- Name: auth_user_user_permissions auth_user_user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_pkey PRIMARY KEY (id);


--
-- Name: auth_user_user_permissions auth_user_user_permissions_user_id_permission_id_14a6b632_uniq; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_user_id_permission_id_14a6b632_uniq UNIQUE (user_id, permission_id);


--
-- Name: auth_user auth_user_username_key; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_username_key UNIQUE (username);


--
-- Name: django_admin_log django_admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_pkey PRIMARY KEY (id);


--
-- Name: django_content_type django_content_type_app_label_model_76bd3d3b_uniq; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model);


--
-- Name: django_content_type django_content_type_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_pkey PRIMARY KEY (id);


--
-- Name: django_migrations django_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_migrations
    ADD CONSTRAINT django_migrations_pkey PRIMARY KEY (id);


--
-- Name: django_session django_session_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_session
    ADD CONSTRAINT django_session_pkey PRIMARY KEY (session_key);


--
-- Name: hornet_apiary hornet_apiary_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.hornet_apiary
    ADD CONSTRAINT hornet_apiary_pkey PRIMARY KEY (id);


--
-- Name: hornet_hornet hornet_hornet_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.hornet_hornet
    ADD CONSTRAINT hornet_hornet_pkey PRIMARY KEY (id);


--
-- Name: hornet_nest hornet_nest_pkey; Type: CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.hornet_nest
    ADD CONSTRAINT hornet_nest_pkey PRIMARY KEY (id);


--
-- Name: auth_group_name_a6ea08ec_like; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_group_name_a6ea08ec_like ON public.auth_group USING btree (name varchar_pattern_ops);


--
-- Name: auth_group_permissions_group_id_b120cbf9; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_group_permissions_group_id_b120cbf9 ON public.auth_group_permissions USING btree (group_id);


--
-- Name: auth_group_permissions_permission_id_84c5c92e; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_group_permissions_permission_id_84c5c92e ON public.auth_group_permissions USING btree (permission_id);


--
-- Name: auth_permission_content_type_id_2f476e4b; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_permission_content_type_id_2f476e4b ON public.auth_permission USING btree (content_type_id);


--
-- Name: auth_user_groups_group_id_97559544; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_user_groups_group_id_97559544 ON public.auth_user_groups USING btree (group_id);


--
-- Name: auth_user_groups_user_id_6a12ed8b; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_user_groups_user_id_6a12ed8b ON public.auth_user_groups USING btree (user_id);


--
-- Name: auth_user_user_permissions_permission_id_1fbb5f2c; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_user_user_permissions_permission_id_1fbb5f2c ON public.auth_user_user_permissions USING btree (permission_id);


--
-- Name: auth_user_user_permissions_user_id_a95ead1b; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_user_user_permissions_user_id_a95ead1b ON public.auth_user_user_permissions USING btree (user_id);


--
-- Name: auth_user_username_6821ab7c_like; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX auth_user_username_6821ab7c_like ON public.auth_user USING btree (username varchar_pattern_ops);


--
-- Name: django_admin_log_content_type_id_c4bce8eb; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX django_admin_log_content_type_id_c4bce8eb ON public.django_admin_log USING btree (content_type_id);


--
-- Name: django_admin_log_user_id_c564eba6; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX django_admin_log_user_id_c564eba6 ON public.django_admin_log USING btree (user_id);


--
-- Name: django_session_expire_date_a5c62663; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX django_session_expire_date_a5c62663 ON public.django_session USING btree (expire_date);


--
-- Name: django_session_session_key_c0390e0f_like; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX django_session_session_key_c0390e0f_like ON public.django_session USING btree (session_key varchar_pattern_ops);


--
-- Name: hornet_apiary_point_02de679b_id; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX hornet_apiary_point_02de679b_id ON public.hornet_apiary USING gist (point);


--
-- Name: hornet_hornet_linked_nest_id_c88a54e6; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX hornet_hornet_linked_nest_id_c88a54e6 ON public.hornet_hornet USING btree (linked_nest_id);


--
-- Name: hornet_hornet_point_dfe572f2_id; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX hornet_hornet_point_dfe572f2_id ON public.hornet_hornet USING gist (point);


--
-- Name: hornet_nest_point_ef559bda_id; Type: INDEX; Schema: public; Owner: hornet_finder
--

CREATE INDEX hornet_nest_point_ef559bda_id ON public.hornet_nest USING gist (point);


--
-- Name: auth_group_permissions auth_group_permissio_permission_id_84c5c92e_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_group_permissions auth_group_permissions_group_id_b120cbf9_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_permission auth_permission_content_type_id_2f476e4b_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_user_groups auth_user_groups_group_id_97559544_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_group_id_97559544_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_user_groups auth_user_groups_user_id_6a12ed8b_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_user_id_6a12ed8b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_user_user_permissions auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_user_user_permissions auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_content_type_id_c4bce8eb_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_user_id_c564eba6_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_user_id_c564eba6_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: hornet_hornet hornet_hornet_linked_nest_id_c88a54e6_fk_hornet_nest_id; Type: FK CONSTRAINT; Schema: public; Owner: hornet_finder
--

ALTER TABLE ONLY public.hornet_hornet
    ADD CONSTRAINT hornet_hornet_linked_nest_id_c88a54e6_fk_hornet_nest_id FOREIGN KEY (linked_nest_id) REFERENCES public.hornet_nest(id) DEFERRABLE INITIALLY DEFERRED;


--
-- PostgreSQL database dump complete
--

